-- 0226: dados de pagamento do mestre e pedidos de saque por serviço.
-- O mestre não introduz o valor: o sistema usa o provider_payout calculado
-- no pagamento (job_payments) e envia para os dados bancários guardados.

create table if not exists provider_payout_accounts (
  profile_id uuid primary key references profiles(id) on delete cascade,
  method payment_method not null default 'emola',
  account_name text not null,
  msisdn text,
  bank_name text,
  account_number text,
  updated_at timestamptz not null default now()
);

alter table provider_payout_accounts enable row level security;

drop policy if exists "payout_accounts_select_own" on provider_payout_accounts;
create policy "payout_accounts_select_own" on provider_payout_accounts for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "payout_accounts_insert_own" on provider_payout_accounts;
create policy "payout_accounts_insert_own" on provider_payout_accounts for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "payout_accounts_update_own" on provider_payout_accounts;
create policy "payout_accounts_update_own" on provider_payout_accounts for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table payouts add column if not exists job_id uuid references jobs(id);
alter table payouts add column if not exists account_name text;
alter table payouts add column if not exists bank_name text;
alter table payouts add column if not exists account_number text;

create unique index if not exists payouts_job_uq on payouts(job_id) where job_id is not null;

alter table payouts enable row level security;

drop policy if exists "payouts_select_own" on payouts;
create policy "payouts_select_own" on payouts for select to authenticated
  using (provider_id = auth.uid());

-- pedir saque de um serviço concluído (valor vem do pagamento, nunca do cliente)
create or replace function request_job_payout(p_job uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_pay job_payments;
  v_acc provider_payout_accounts;
  v_payout_id uuid;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found then raise exception 'job_not_found'; end if;
  if v_job.provider_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_job.status <> 'completed' then raise exception 'job_not_completed'; end if;

  select * into v_pay from job_payments where job_id = p_job for update;
  if not found or v_pay.status <> 'released' then raise exception 'payment_not_released'; end if;

  if exists (select 1 from payouts where job_id = p_job) then
    raise exception 'already_requested';
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

  perform wallet_apply(
    auth.uid(), 'withdrawal', -v_pay.provider_payout,
    'Pedido de saque do serviço', null,
    jsonb_build_object('job_id', p_job, 'payout_id', v_payout_id)
  );

  return v_payout_id;
end $$;

revoke execute on function request_job_payout(uuid) from anon;
grant execute on function request_job_payout(uuid) to authenticated;
