-- Migration 0004: Carteira, pagamentos, planos, destaques, afiliados
-- Bué de Mestres — Fase 0

create table payments (           -- carregamentos (entrada de dinheiro real)
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  amount numeric(12,2) not null check (amount >= 50),
  method payment_method not null,
  msisdn text,
  status payment_status not null default 'pending',
  provider_ref text unique,        -- idempotência de webhooks
  proof_path text,                 -- comprovativo (modo manual)
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on payments(profile_id, status);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  type tx_type not null,
  amount numeric(12,2) not null,   -- + entrada, - saída
  balance_after numeric(12,2) not null,
  status tx_status not null default 'completed',
  description text,
  payment_id uuid references payments(id),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on wallet_transactions(profile_id, created_at desc);

create table plans (
  id serial primary key,
  code text not null unique,
  name text not null,
  price numeric(12,2) not null,
  duration_days int not null default 30,
  max_services int not null,
  max_photos int not null,
  max_categories int not null default 1,
  can_quote_unlimited boolean not null default false,
  monthly_quotes int,              -- null = ilimitado
  featured_days_included int not null default 0,
  badge text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  plan_id int not null references plans(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status sub_status not null default 'active',
  auto_renew boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index one_active_sub on subscriptions(provider_id) where status = 'active';

create table boosts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  type boost_type not null,
  category_id int references categories(id),  -- null = página inicial
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  price_paid numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index on boosts(type, ends_at);

create table boost_prices (
  type boost_type not null,
  days int not null,
  price numeric(12,2) not null,
  primary key (type, days)
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id),
  referred_id uuid not null unique references profiles(id),
  commission_until timestamptz not null default now() + interval '90 days',
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create table affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id),
  referred_id uuid not null references profiles(id),
  payment_id uuid not null unique references payments(id),
  amount numeric(12,2) not null,
  status commission_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  link_url text,
  placement text not null default 'home_top',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true
);

create table audit_logs (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
