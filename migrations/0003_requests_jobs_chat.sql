-- Migration 0003: Pedidos, orçamentos, trabalhos, chat, avaliações
-- Bué de Mestres — Fase 0

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  category_id int not null references categories(id),
  target_provider_id uuid references provider_profiles(profile_id), -- pedido directo (opcional)
  title text not null,
  description text not null,
  district_id int references districts(id),
  address text,
  preferred_date date,
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  status request_status not null default 'open',
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on service_requests(status, category_id, district_id);
create index on service_requests(client_id);

create table request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  message text,
  estimated_days smallint,
  status quote_status not null default 'sent',
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references service_requests(id),
  quote_id uuid references quotes(id),
  client_id uuid not null references profiles(id),
  provider_id uuid not null references provider_profiles(profile_id),
  agreed_amount numeric(12,2),
  status job_status not null default 'scheduled',
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now()
);
create index on jobs(client_id);
create index on jobs(provider_id, status);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  request_id uuid references service_requests(id),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id, provider_id, request_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or attachment_url is not null)
);
create index on messages(conversation_id, created_at desc);

-- Avaliação só é possível após job concluído; 1 por job
create table reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references jobs(id) on delete cascade,
  client_id uuid not null references profiles(id),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  provider_reply text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on reviews(provider_id, created_at desc);

create table favorites (
  client_id uuid references profiles(id) on delete cascade,
  provider_id uuid references provider_profiles(profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, provider_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  target_type report_target not null,
  target_id uuid not null,
  reason text not null,
  status report_status not null default 'open',
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(profile_id, read_at, created_at desc);
