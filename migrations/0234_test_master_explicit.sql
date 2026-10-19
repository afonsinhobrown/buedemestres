-- 0234: Isenção de saldo só para emails explícitos de mestres de teste
-- A 0233 isentava por domínio (@teste.com), o que apanhava também perfis de
-- CLIENTE que por acaso têm linha em provider_profiles (ex.: cliente@teste.com).
-- Regra correta: a isenção/recarga aplica-se apenas aos emails listados
-- explicitamente E apenas a quem atua como mestre.
--
-- O cliente NÃO tem de recarregar a carteira: paga o serviço diretamente. A
-- carteira serve, para ele, apenas para receber estornos. Por isso removemos
-- também a recarga automática que tinha sido atribuída ao cliente em 0233.

-- 1. Configuração: emails explícitos (deixa de ser um domínio genérico) --------
update app_settings
   set value = '"mestre@teste.com"'::jsonb, updated_at = now()
 where key = 'master_min_balance_exempt_domains';

insert into app_settings(key, value)
values ('master_min_balance_exempt_domains', '"mestre@teste.com"'::jsonb)
on conflict (key) do nothing;

-- 2. Isenção: só emails explícitos, e só quem atua como mestre ---------------
-- Exige (a) estar na lista de emails configurada (match exato) e (b) ter perfil
-- de mestre. Domínios genéricos deixam de ser suportados de propósito.
create or replace function master_min_balance_exempt(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with cfg as (
    select lower(coalesce(
      nullif(regexp_replace(app_setting_text('master_min_balance_exempt_domains', 'mestre@teste.com'), '\s', '', 'g'), ''),
      'mestre@teste.com'
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
       and lower(p.email) = tokens.t
  )
  and exists (select 1 from provider_profiles pp where pp.profile_id = p_provider)
$$;

-- 3. Recarga automática: nunca aplicar a clientes ----------------------------
-- Só recarrega quem é isento E efetivamente atua como mestre, excluindo contas
-- de cliente. Mantém o resto igual.
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

-- 4. Corrigir a recarga indevida do cliente ----------------------------------
-- Reverte a recarga automática atribuída a quem deixou de ser isento (ex.:
-- cliente@teste.com): debita o valor creditado pela "Recarga automática
-- (mestre de teste)", sem tocar no resto do saldo.
do $fix$
declare
  v_row record;
begin
  for v_row in
    select w.profile_id,
           coalesce(sum(t.amount), 0) as credited
      from wallet_transactions t
      join wallets w on w.profile_id = t.profile_id
     where t.description = 'Recarga automática (mestre de teste)'
       and not master_min_balance_exempt(t.profile_id)
     group by w.profile_id
  loop
    if v_row.credited > 0 and master_wallet_balance(v_row.profile_id) >= v_row.credited then
      perform wallet_apply(
        v_row.profile_id, 'refund', -v_row.credited,
        'Reversão de recarga automática (conta de cliente)',
        null, jsonb_build_object('test_master_revert', true)
      );
    end if;
  end loop;
end $fix$;

-- Reaplica a isenção correta (recarrega apenas os mestres de teste explícitos).
select ensure_test_master_balance();

-- 5. Permissões --------------------------------------------------------------
revoke execute on function master_min_balance_exempt(uuid) from public, anon, authenticated;
revoke execute on function ensure_test_master_balance() from public, anon, authenticated;
