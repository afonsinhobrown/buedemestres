-- 0255: lotes diários de saque
-- Mantém os payouts por job para rastreabilidade; um lote agrupa vários payouts
-- e é enviado ao gateway numa única transferência.

alter table payouts
  add column if not exists batch_id uuid;

create table if not exists payout_batches (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id),
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  status payout_status not null default 'pending',
  provider_ref text unique,
  failure_reason text,
  scheduled_for timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payouts_batch_id_fkey'
  ) then
    alter table payouts
      add constraint payouts_batch_id_fkey
      foreign key (batch_id) references payout_batches(id) on delete set null;
  end if;
end $$;

create index if not exists payouts_batch_idx on payouts(batch_id);
create index if not exists payout_batches_provider_idx on payout_batches(provider_id);
create index if not exists payout_batches_status_idx on payout_batches(status);
create index if not exists payout_batches_scheduled_idx on payout_batches(scheduled_for);
