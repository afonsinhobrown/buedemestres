-- 0245: em sandbox, contas de teste @teste.com recebem créditos, saldo e trial
-- automaticamente, sem pagamento. Idempotente e configurável em app_settings.
--
-- Motivo: a lógica de aceitação exige trial/plano/créditos. Em testes não deve
-- haver pagamento nem bloqueio por "créditos esgotados". Esta migração garante
-- um piso de créditos e saldo apenas em modo sandbox, e reagenda a recarga.

insert into app_settings(key, value) values
  ('sandbox_test_credit_floor', '100'::jsonb),
  ('sandbox_test_wallet_floor', '10000'::jsonb),
  ('sandbox_test_trial_days', '365'::jsonb)
on conflict (key) do nothing;

create or replace function ensure_sandbox_test_accounts()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_credit_floor int := coalesce(app_setting_int('sandbox_test_credit_floor', 100), 100);
  v_wallet_floor numeric := coalesce(app_setting_numeric('sandbox_test_wallet_floor', 10000), 10000);
  v_trial_days int := coalesce(app_setting_int('sandbox_test_trial_days', 365), 365);
  v_row record;
  v_count int := 0;
begin
  if not sandbox_active() then
    return 0;
  end if;

  if v_credit_floor < 0 then v_credit_floor := 0; end if;
  if v_wallet_floor < 0 then v_wallet_floor := 0; end if;
  if v_trial_days < 0 then v_trial_days := 0; end if;

  for v_row in
    select pp.profile_id
      from provider_profiles pp
      join profiles p on p.id = pp.profile_id
     where lower(p.email) like '%@teste.com'
  loop
    insert into wallets(profile_id, balance)
    values (v_row.profile_id, v_wallet_floor)
    on conflict (profile_id) do update
      set balance = greatest(wallets.balance, excluded.balance),
          updated_at = now();

    insert into service_credits(provider_id, balance)
    values (v_row.profile_id, v_credit_floor)
    on conflict (provider_id) do update
      set balance = greatest(service_credits.balance, excluded.balance),
          updated_at = now();

    update provider_profiles
       set trial_started_at = coalesce(trial_started_at, now()),
           trial_ends_at = greatest(
             coalesce(trial_ends_at, now()),
             now() + make_interval(days => v_trial_days)
           ),
           updated_at = now()
     where profile_id = v_row.profile_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Aplica já, para não haver testes bloqueados.
select ensure_sandbox_test_accounts();

-- Reagenda a recarga a cada 10 minutos, quando pg_cron estiver disponível.
do $cron_setup$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'sandbox-test-accounts') then
      perform cron.unschedule('sandbox-test-accounts');
    end if;
    perform cron.schedule(
      'sandbox-test-accounts',
      '*/10 * * * *',
      $cron$select ensure_sandbox_test_accounts()$cron$
    );
  end if;
exception when others then
  raise notice 'pg_cron indisponível para contas de teste: %', sqlerrm;
end $cron_setup$;

-- Só uso interno (cron/funções security definer).
revoke execute on function ensure_sandbox_test_accounts() from public, anon, authenticated;
