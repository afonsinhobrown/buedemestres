-- 0229: sócios, quotas fixas e distribuição de receita da plataforma.
-- As quotas (40/60) ficam na BD e não são editáveis por nenhum ecrã.

create table if not exists partners (
  id text primary key,
  name text not null,
  email text,
  share_pct numeric(5,4) not null check (share_pct > 0 and share_pct <= 1),
  profile_id uuid references profiles(id) on delete set null,
  method payment_method not null default 'bank_transfer',
  account_name text,
  msisdn text,
  bank_name text,
  account_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into partners(id, name, email, share_pct) values
  ('afonso', 'Afonso Pene', 'nachingweya@gmail.com', 0.4000),
  ('rfl', 'RFL Consultores', null, 0.6000)
on conflict (id) do nothing;

create or replace function prevent_partner_share_change()
returns trigger language plpgsql as $$
begin
  if new.share_pct is distinct from old.share_pct then
    raise exception 'partner_share_locked';
  end if;
  return new;
end $$;

drop trigger if exists partners_share_locked on partners;
create trigger partners_share_locked
  before update on partners
  for each row execute function prevent_partner_share_change();

create table if not exists platform_withdrawals (
  id uuid primary key default gen_random_uuid(),
  available_revenue numeric(12,2) not null check (available_revenue > 0),
  withdraw_pct numeric(5,4) not null check (withdraw_pct >= 0 and withdraw_pct <= 1),
  retain_pct numeric(5,4) not null check (retain_pct >= 0 and retain_pct <= 1),
  distributed_amount numeric(12,2) not null check (distributed_amount >= 0),
  retained_amount numeric(12,2) not null check (retained_amount >= 0),
  status text not null default 'pending_approval'
    check (status in ('pending_approval','processing','completed','failed','cancelled')),
  approval_required boolean not null default true,
  requested_by uuid references profiles(id),
  failure_reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  completed_at timestamptz
);

create table if not exists platform_withdrawal_approvals (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references platform_withdrawals(id) on delete cascade,
  partner_id text not null references partners(id),
  approved_by uuid not null references profiles(id),
  approved_at timestamptz not null default now(),
  unique (withdrawal_id, partner_id),
  unique (withdrawal_id, approved_by)
);

create table if not exists partner_payouts (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references platform_withdrawals(id) on delete cascade,
  partner_id text not null references partners(id),
  amount numeric(12,2) not null check (amount >= 0),
  method payment_method not null,
  msisdn text,
  account_name text,
  bank_name text,
  account_number text,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed')),
  provider_ref text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (withdrawal_id, partner_id)
);

alter table partners enable row level security;
alter table platform_withdrawals enable row level security;
alter table platform_withdrawal_approvals enable row level security;
alter table partner_payouts enable row level security;

insert into app_settings(key, value) values
  ('platform_withdraw_pct', '0.5'::jsonb),
  ('platform_retain_pct', '0.5'::jsonb),
  ('platform_withdrawal_approval', 'true'::jsonb)
on conflict (key) do nothing;
