-- 0233: Mestres de teste isentos de saldo mínimo e sempre com saldo positivo
-- A regra de saldo mínimo (0231) bloqueia mestres com carteira a zero. Para os
-- testes (contas @teste.com e afins) isso pára tudo, por isso:
--   * isenta esses mestres da exigência de saldo mínimo (podem operar sempre);
--   * garante que a carteira deles nunca fica a zero (top-up automático), para
--     as multas e estornos continuarem a ser demonstráveis nos testes.
--
-- Tudo configurável em app_settings, sem deploy.

-- 1. Configuração -------------------------------------------------------------
insert into app_settings(key, value) values
  ('master_min_balance_exempt_domains', '"@teste.com"'::jsonb),
  ('test_master_balance_floor', '1000'::jsonb)
on conflict (key) do nothing;

-- 2. Deteção de mestre de teste ----------------------------------------------
-- Considera isento quem fizer parte da lista de emails/domínios configurada.
-- A configuração é uma string com valores separados por vírgula (sem espaços),
-- ex.: "@teste.com,demo@exemplo.com".
create or replace function master_min_balance_exempt(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with cfg as (
    select lower(coalesce(
      nullif(regexp_replace(app_setting_text('master_min_balance_exempt_domains', '@teste.com'), '\s', '', 'g'), ''),
      '@teste.com'
    )) as raw
  ),
  tokens as (
    select unnest(string_to_array((select raw from cfg), ',')) as t
  )
  select exists (
    select 1
      from profiles p, tokens
     where p.id = p_provider
       and p.email is not null
       and (
         (tokens.t like '@%' and lower(p.email) like '%' || tokens.t)
         or lower(p.email) = tokens.t
       )
  )
$$;

-- Mestres de teste podem sempre operar (não dependem do saldo).
create or replace function master_can_operate(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select master_min_balance_exempt(p_provider)
      or not app_setting_bool('master_min_balance_enforced', true)
      or master_wallet_balance(p_provider) >= master_min_balance()
$$;

-- 3. Manter os mestres de teste com saldo positivo ---------------------------
-- Recarrega a carteira dos mestres isentos que estejam abaixo do piso
-- configurado (por defeito 1000 MT). Idempotente.
create or replace function ensure_test_master_balance()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_floor numeric := app_setting_numeric('test_master_balance_floor', 1000);
  v_row record;
  v_delta numeric;
  v_count int := 0;
begin
  if v_floor <= 0 then return 0; end if;

  for v_row in
    select pp.profile_id
      from provider_profiles pp
     where master_min_balance_exempt(pp.profile_id)
       for update
  loop
    insert into wallets(profile_id) values (v_row.profile_id)
      on conflict (profile_id) do nothing;

    v_delta := v_floor - master_wallet_balance(v_row.profile_id);
    if v_delta > 0 then
      perform wallet_apply(
        v_row.profile_id, 'refund', v_delta,
        'Recarga automática (mestre de teste)',
        null, jsonb_build_object('test_master', true)
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end $$;

-- Aplica já, uma vez, para não haver testes bloqueados.
select ensure_test_master_balance();

-- 4. Agendamento (a cada 10 min) ---------------------------------------------
do $cron_setup$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'test-master-balance') then
      perform cron.unschedule('test-master-balance');
    end if;
    perform cron.schedule('test-master-balance', '*/10 * * * *',
      $cron$select ensure_test_master_balance()$cron$);
  end if;
exception when others then
  raise notice 'pg_cron indisponível para saldo de teste: %', sqlerrm;
end $cron_setup$;

-- 5. Permissões --------------------------------------------------------------
revoke execute on function master_min_balance_exempt(uuid) from public, anon, authenticated;
revoke execute on function ensure_test_master_balance() from public, anon, authenticated;
