-- 0253: separar saldo de OPERAÇÃO (carregamentos) de GANHOS (serviços)
--
-- Regras:
--   * `wallets.balance`          -> saldo de operação (carregamentos / ajustes)
--   * `wallets.earnings_balance` -> ganhos dos serviços (dinheiro a receber/sacar)
--   * `wallets.platform_debt`    -> comissões/multas não cobertas pelo saldo
--
--   * Comissão (20% do valor do serviço), multas, planos e destaques debitam
--     APENAS o saldo de operação.
--   * O valor do serviço é creditado INTEGRALMENTE em `earnings_balance`
--     (o mestre recebe 100% do serviço; a comissão sai do saldo carregado).
--   * Se o saldo de operação não cobrir a comissão, o restante fica em
--     `platform_debt` e `master_can_operate` bloqueia novos serviços até
--     o mestre carregar. Os ganhos nunca são tocados.
--   * Saques debitam apenas `earnings_balance`.
--   * Ao carregar saldo, a dívida é regularizada automaticamente.
--
-- Tudo isto é server-side: a app Pro continua a ler `wallets.balance` e a
-- chamar `request_job_payout`, sem precisar de novo APK.

-- ===== 1. Colunas =====
alter table wallets
  add column if not exists earnings_balance numeric(12,2) not null default 0;
alter table wallets
  add column if not exists platform_debt numeric(12,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wallets_earnings_balance_nonneg') then
    alter table wallets add constraint wallets_earnings_balance_nonneg
      check (earnings_balance >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wallets_platform_debt_nonneg') then
    alter table wallets add constraint wallets_platform_debt_nonneg
      check (platform_debt >= 0);
  end if;
end $$;

-- ===== 2. Migrar saldos existentes =====
-- O que está por receber de serviços já libertados e ainda não levantados
-- passa do saldo de operação para os ganhos.
with pending as (
  select jp.provider_id, sum(jp.provider_payout) as amount
    from job_payments jp
   where jp.status = 'released'
     and not exists (
       select 1 from payouts p
        where p.job_id = jp.job_id and p.status <> 'failed'
     )
   group by jp.provider_id
)
update wallets w
   set earnings_balance = least(w.balance, coalesce(p.amount, 0)),
       balance = w.balance - least(w.balance, coalesce(p.amount, 0)),
       updated_at = now()
  from pending p
 where p.provider_id = w.profile_id
   and coalesce(w.earnings_balance, 0) = 0;

-- ===== 3. Regularização automática da dívida =====
create or replace function settle_platform_debt(p_profile uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric;
  v_debt numeric;
  v_take numeric;
begin
  select balance, platform_debt into v_bal, v_debt
    from wallets where profile_id = p_profile for update;

  if v_bal is null or coalesce(v_debt, 0) <= 0 then return 0; end if;

  v_take := least(greatest(coalesce(v_bal, 0), 0), v_debt);
  if v_take <= 0 then return 0; end if;

  update wallets
     set balance = balance - v_take,
         platform_debt = platform_debt - v_take,
         updated_at = now()
   where profile_id = p_profile;

  insert into wallet_transactions(
    profile_id, type, amount, balance_after, description, meta
  ) values (
    p_profile, 'job_commission', -v_take, v_bal - v_take,
    'Regularização de comissão em dívida',
    jsonb_build_object('kind', 'debt_settlement', 'bucket', 'operation')
  );

  return v_take;
end $$;

revoke execute on function settle_platform_debt(uuid) from public, anon, authenticated;

-- ===== 4. wallet_apply -> saldo de OPERAÇÃO =====
create or replace function wallet_apply(
  p_profile uuid, p_type tx_type, p_amount numeric, p_desc text,
  p_payment uuid default null, p_meta jsonb default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid;
begin
  select balance into v_bal from wallets where profile_id = p_profile for update;
  if v_bal is null then raise exception 'wallet_not_found'; end if;
  if v_bal + p_amount < 0 then raise exception 'insufficient_funds'; end if;

  update wallets set balance = balance + p_amount, updated_at = now()
   where profile_id = p_profile;

  insert into wallet_transactions(profile_id,type,amount,balance_after,description,payment_id,meta)
  values (
    p_profile, p_type, p_amount, v_bal + p_amount, p_desc, p_payment,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('bucket', 'operation')
  ) returning id into v_id;

  -- Carregamentos/ajustes positivos pagam primeiro a dívida pendente.
  if p_amount > 0 then
    perform settle_platform_debt(p_profile);
  end if;

  return v_id;
end $$;

revoke execute on function wallet_apply(uuid, tx_type, numeric, text, uuid, jsonb) from anon, authenticated;

-- ===== 5. wallet_apply_earnings -> saldo de GANHOS =====
create or replace function wallet_apply_earnings(
  p_profile uuid, p_type tx_type, p_amount numeric, p_desc text,
  p_payment uuid default null, p_meta jsonb default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid;
begin
  select earnings_balance into v_bal from wallets where profile_id = p_profile for update;
  if v_bal is null then raise exception 'wallet_not_found'; end if;
  if v_bal + p_amount < 0 then raise exception 'insufficient_funds'; end if;

  update wallets set earnings_balance = earnings_balance + p_amount, updated_at = now()
   where profile_id = p_profile;

  insert into wallet_transactions(profile_id,type,amount,balance_after,description,payment_id,meta)
  values (
    p_profile, p_type, p_amount, v_bal + p_amount, p_desc, p_payment,
    coalesce(p_meta, '{}'::jsonb) || jsonb_build_object('bucket', 'earnings')
  ) returning id into v_id;

  return v_id;
end $$;

revoke execute on function wallet_apply_earnings(uuid, tx_type, numeric, text, uuid, jsonb) from public, anon, authenticated;

-- ===== 6. Remover a antiga regra commission_amount + provider_payout = amount =====
-- Agora o payout é o valor integral do serviço e a comissão é registada à parte.
do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass as tbl
      from pg_constraint
     where conrelid in ('job_payments'::regclass, 'job_addenda'::regclass)
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%commission_amount%provider_payout%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- ===== 7. Libertação do pagamento principal =====
create or replace function release_job_payment(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pay job_payments;
  v_balance numeric;
  v_commission_total numeric;
  v_wallet_take numeric;
  v_debt_add numeric;
begin
  select * into v_pay from job_payments where job_id = p_job for update;
  if not found or v_pay.status <> 'held' then return; end if;

  insert into wallets(profile_id) values (v_pay.provider_id)
    on conflict (profile_id) do nothing;

  v_commission_total := coalesce(v_pay.commission_amount, 0)
                      + coalesce(v_pay.commission_from_wallet, 0);

  select balance into v_balance
    from wallets where profile_id = v_pay.provider_id for update;

  v_wallet_take := least(greatest(coalesce(v_balance, 0), 0), v_commission_total);
  v_debt_add := v_commission_total - v_wallet_take;

  if v_wallet_take > 0 then
    update wallets
       set balance = balance - v_wallet_take, updated_at = now()
     where profile_id = v_pay.provider_id;

    insert into wallet_transactions(
      profile_id, type, amount, balance_after, description, meta
    ) values (
      v_pay.provider_id, 'job_commission', -v_wallet_take, v_balance - v_wallet_take,
      'Comissão da plataforma (saldo de operação)',
      jsonb_build_object('job_id', p_job, 'kind', 'commission', 'bucket', 'operation')
    );
  end if;

  if v_debt_add > 0 then
    update wallets
       set platform_debt = platform_debt + v_debt_add, updated_at = now()
     where profile_id = v_pay.provider_id;

    insert into wallet_transactions(
      profile_id, type, amount, balance_after, description, meta
    ) values (
      v_pay.provider_id, 'job_commission', 0, v_balance - v_wallet_take,
      'Comissão em dívida — carrega saldo para voltar a operar',
      jsonb_build_object('job_id', p_job, 'kind', 'commission_debt', 'debt', v_debt_add, 'bucket', 'operation')
    );
  end if;

  -- O mestre recebe o valor integral do serviço nos ganhos.
  perform wallet_apply_earnings(
    v_pay.provider_id, 'job_payout', v_pay.amount,
    'Serviço concluído', null,
    jsonb_build_object('job_id', p_job, 'commission', v_commission_total, 'debt', v_debt_add)
  );

  insert into platform_revenue(kind, amount, job_id, profile_id)
  values ('commission', v_commission_total, p_job, v_pay.provider_id);

  update job_payments
     set status = 'released',
         released_at = now(),
         commission_from_wallet = v_wallet_take,
         commission_amount = v_debt_add,
         provider_payout = v_pay.amount
   where id = v_pay.id;

  update jobs set status = 'completed' where id = p_job;
  update provider_presence set active_job_id = null where active_job_id = p_job;
end $$;

-- ===== 8. Libertação dos aditamentos =====
create or replace function release_job_addenda(p_job uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_provider uuid;
  v_row job_addenda;
  v_balance numeric;
  v_commission_total numeric;
  v_wallet_take numeric;
  v_debt_add numeric;
  v_total numeric := 0;
begin
  select provider_id into v_provider from job_payments where job_id = p_job limit 1;
  if v_provider is null then return 0; end if;

  insert into wallets(profile_id) values (v_provider)
    on conflict (profile_id) do nothing;

  for v_row in
    select * from job_addenda
     where job_id = p_job and status = 'held'
     order by created_at
     for update
  loop
    v_commission_total := coalesce(v_row.commission_amount, 0)
                        + coalesce(v_row.commission_from_wallet, 0);

    select balance into v_balance
      from wallets where profile_id = v_provider for update;

    v_wallet_take := least(greatest(coalesce(v_balance, 0), 0), v_commission_total);
    v_debt_add := v_commission_total - v_wallet_take;

    if v_wallet_take > 0 then
      update wallets
         set balance = balance - v_wallet_take, updated_at = now()
       where profile_id = v_provider;

      insert into wallet_transactions(
        profile_id, type, amount, balance_after, description, meta
      ) values (
        v_provider, 'job_commission', -v_wallet_take, v_balance - v_wallet_take,
        'Comissão da plataforma — aditamento (saldo de operação)',
        jsonb_build_object('job_id', p_job, 'addendum_id', v_row.id, 'kind', 'commission', 'bucket', 'operation')
      );
    end if;

    if v_debt_add > 0 then
      update wallets
         set platform_debt = platform_debt + v_debt_add, updated_at = now()
       where profile_id = v_provider;

      insert into wallet_transactions(
        profile_id, type, amount, balance_after, description, meta
      ) values (
        v_provider, 'job_commission', 0, v_balance - v_wallet_take,
        'Comissão de aditamento em dívida',
        jsonb_build_object('job_id', p_job, 'addendum_id', v_row.id, 'kind', 'commission_debt', 'debt', v_debt_add, 'bucket', 'operation')
      );
    end if;

    perform wallet_apply_earnings(
      v_provider, 'job_payout', v_row.amount,
      'Aditamento de serviço', null,
      jsonb_build_object('job_id', p_job, 'addendum_id', v_row.id, 'kind', 'addendum', 'commission', v_commission_total, 'debt', v_debt_add)
    );

    insert into platform_revenue(kind, amount, job_id, profile_id)
    values ('commission', v_commission_total, p_job, v_provider);

    update job_addenda
       set status = 'released',
           released_at = now(),
           commission_from_wallet = v_wallet_take,
           commission_amount = v_debt_add,
           provider_payout = v_row.amount
     where id = v_row.id;

    v_total := v_total + v_row.amount;
  end loop;

  return v_total;
end $$;

-- ===== 9. Saque debitado apenas dos GANHOS =====
create or replace function request_job_payout(p_job uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_pay job_payments;
  v_acc provider_payout_accounts;
  v_old payouts;
  v_payout_id uuid;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found then raise exception 'job_not_found'; end if;
  if v_job.provider_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_job.status <> 'completed' then raise exception 'job_not_completed'; end if;

  select * into v_pay from job_payments where job_id = p_job for update;
  if not found or v_pay.status <> 'released' then raise exception 'payment_not_released'; end if;

  select * into v_old from payouts where job_id = p_job for update;
  if found then
    if v_old.status = 'failed' then
      delete from payouts where id = v_old.id;
    else
      raise exception 'already_requested';
    end if;
  end if;

  select * into v_acc from provider_payout_accounts where profile_id = auth.uid();
  if not found then raise exception 'payout_account_missing'; end if;

  insert into payouts(
    provider_id, amount, method, msisdn, status, job_id,
    account_name, bank_name, account_number
  ) values (
    auth.uid(), v_pay.provider_payout, v_acc.method, v_acc.msisdn, 'pending', p_job,
    v_acc.account_name, v_acc.bank_name, v_acc.account_number
  ) returning id into v_payout_id;

  -- Sai do saldo de GANHOS, nunca do saldo de operação.
  perform wallet_apply_earnings(
    auth.uid(), 'withdrawal', -v_pay.provider_payout,
    'Pedido de saque do serviço', null,
    jsonb_build_object('job_id', p_job, 'payout_id', v_payout_id)
  );

  return v_payout_id;
end $$;

revoke execute on function request_job_payout(uuid) from anon;
grant execute on function request_job_payout(uuid) to authenticated;

-- ===== 10. Multas debitam operação e o resto fica em dívida =====
create or replace function charge_master_fine(
  p_provider uuid, p_job uuid, p_kind text, p_amount numeric
) returns numeric language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_take numeric; v_debt numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  insert into wallets(profile_id) values (p_provider) on conflict (profile_id) do nothing;

  select balance into v_bal from wallets where profile_id = p_provider for update;
  v_take := least(greatest(coalesce(v_bal, 0), 0), p_amount);
  v_debt := p_amount - v_take;

  if v_take > 0 then
    update wallets set balance = balance - v_take, updated_at = now()
     where profile_id = p_provider;

    insert into wallet_transactions(
      profile_id, type, amount, balance_after, description, meta
    ) values (
      p_provider, 'fine', -v_take, v_bal - v_take,
      case p_kind
        when 'cancelamento_apos_deslocacao' then 'Multa por cancelamento após deslocação'
        when 'pedido_abandonado' then 'Multa por pedido pago abandonado'
        else 'Multa da plataforma'
      end,
      jsonb_build_object('job_id', p_job, 'kind', p_kind, 'amount', p_amount, 'bucket', 'operation')
    );

    insert into platform_revenue(kind, amount, job_id, profile_id)
    values ('fine', v_take, p_job, p_provider);
  end if;

  if v_debt > 0 then
    update wallets set platform_debt = platform_debt + v_debt, updated_at = now()
     where profile_id = p_provider;

    insert into wallet_transactions(
      profile_id, type, amount, balance_after, description, meta
    ) values (
      p_provider, 'fine', 0, v_bal - v_take,
      'Multa em dívida — carrega saldo para voltar a operar',
      jsonb_build_object('job_id', p_job, 'kind', p_kind, 'debt', v_debt, 'bucket', 'operation')
    );
  end if;

  return v_take;
end $$;

-- ===== 11. Só opera quem não tem dívida =====
create or replace function master_can_operate(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (
           master_min_balance_exempt(p_provider)
        or sandbox_active()
        or not app_setting_bool('master_min_balance_enforced', true)
        or master_wallet_balance(p_provider) >= master_min_balance()
       )
       and coalesce((select platform_debt from wallets where profile_id = p_provider), 0) <= 0
$$;
