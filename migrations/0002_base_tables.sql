-- Migration 0002: Tabelas base
-- Bué de Mestres — Fase 0

-- Localização
create table provinces (
  id smallint primary key,
  name text not null unique
);

create table districts (
  id serial primary key,
  province_id smallint not null references provinces(id),
  name text not null,
  unique (province_id, name)
);
create index on districts(province_id);

-- Categorias (2 níveis)
create table categories (
  id serial primary key,
  parent_id int references categories(id) on delete cascade,
  slug text not null unique,
  name text not null,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);
create index on categories(parent_id);

-- Perfis (sem referência a auth.users — usamos id próprio com Neon)
create table profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique,
  phone text,
  avatar_url text,
  role user_role not null default 'client',
  district_id int references districts(id),
  referral_code text unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  referred_by uuid references profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Carteira (criada ao registar)
create table wallets (
  profile_id uuid primary key references profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Perfil profissional
create table provider_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  slug text not null unique,
  business_name text not null,
  headline text,
  bio text,
  years_experience smallint,
  primary_category_id int references categories(id),
  district_id int references districts(id),
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  service_radius_km smallint,
  whatsapp text,
  working_hours jsonb not null default '{}',
  verification verification_status not null default 'none',
  verified_at timestamptz,
  is_available boolean not null default true,
  is_published boolean not null default false,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  jobs_completed int not null default 0,
  search_document tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index provider_search_gin on provider_profiles using gin(search_document);
create index provider_name_trgm on provider_profiles using gin(business_name gin_trgm_ops);
create index on provider_profiles(primary_category_id, district_id) where is_published;
create index on provider_profiles(verification);

create table provider_categories (
  provider_id uuid references provider_profiles(profile_id) on delete cascade,
  category_id int references categories(id) on delete cascade,
  primary key (provider_id, category_id)
);

create table provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  category_id int references categories(id),
  title text not null,
  description text,
  price_type price_type not null default 'quote',
  price_min numeric(12,2),
  price_max numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on provider_services(provider_id);

create table provider_media (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  url text not null,
  caption text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index on provider_media(provider_id);

-- Verificação de identidade (bucket privado)
create table verification_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  doc_type doc_type not null,
  doc_number text,
  front_path text not null,
  back_path text,
  selfie_path text not null,
  expires_on date,
  status verification_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on verification_documents(status, created_at);
