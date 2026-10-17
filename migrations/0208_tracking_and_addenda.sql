-- 0208: tracking do mestre e aditamentos de orçamento no local.
alter table jobs add column if not exists provider_lat numeric(9,6);
alter table jobs add column if not exists provider_lng numeric(9,6);
alter table jobs add column if not exists provider_heading numeric(5,2);
alter table jobs add column if not exists location_updated_at timestamptz;

create table if not exists job_addenda (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  commission_rate numeric(5,4) not null default 0.1200,
  commission_amount numeric(12,2) not null,
  provider_payout numeric(12,2) not null,
  description text,
  method payment_method not null default 'manual',
  status escrow_status not null default 'pending_payment',
  provider_ref text unique,
  checkout_url text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  held_at timestamptz,
  released_at timestamptz,
  check (commission_amount + provider_payout = amount)
);

create index if not exists job_addenda_job_idx on job_addenda(job_id, created_at desc);
create unique index if not exists job_addenda_active_uq
  on job_addenda(job_id)
  where status in ('pending_payment', 'held');
