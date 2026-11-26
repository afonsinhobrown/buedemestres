-- 0256: catálogo fixo, regras de preço, sintomas e benchmarks
-- Tabelas novas de produto. Não substituem provider_services nem categorias.

create table if not exists service_catalog (
  id uuid primary key default gen_random_uuid(),
  category_id integer not null references categories(id),
  slug text not null unique,
  name text not null,
  description text,
  pricing_mode text not null check (pricing_mode in ('fixed', 'quote', 'hybrid')),
  fixed_labor_amount numeric(12,2),
  min_labor numeric(12,2),
  max_labor numeric(12,2),
  duration_min smallint,
  parts_included boolean not null default false,
  variants jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'category', 'district', 'catalog')),
  category_id integer references categories(id),
  district_id integer references districts(id),
  catalog_id uuid references service_catalog(id) on delete cascade,
  kind text not null check (kind in ('travel', 'night', 'weekend', 'urgency', 'hourly_rate')),
  base_fee numeric(12,2),
  per_km numeric(12,2),
  included_km numeric(10,2),
  min_fee numeric(12,2),
  max_fee numeric(12,2),
  road_factor numeric(6,3) not null default 1.25,
  multiplier numeric(6,3) not null default 1,
  priority smallint not null default 0,
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists symptoms (
  id uuid primary key default gen_random_uuid(),
  category_id integer not null references categories(id),
  slug text not null unique,
  label text not null,
  icon text,
  pricing_mode text not null check (pricing_mode in ('fixed', 'diagnostic')),
  catalog_id uuid references service_catalog(id) on delete set null,
  diagnostic_catalog_id uuid references service_catalog(id) on delete set null,
  urgency urgency_level not null default 'today',
  safety_level text not null default 'normal' check (safety_level in ('normal', 'urgent', 'emergency')),
  safety_message text,
  follow_up_schema jsonb not null default '[]'::jsonb,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists price_benchmarks (
  id uuid primary key default gen_random_uuid(),
  category_id integer not null references categories(id),
  district_id integer references districts(id),
  problem_type text,
  p25_labor numeric(12,2),
  p75_labor numeric(12,2),
  avg_parts numeric(12,2),
  sample_size integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ===== FKs que dependiam das novas tabelas =====
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_catalog_id_fkey') then
    alter table jobs
      add constraint jobs_catalog_id_fkey
      foreign key (catalog_id) references service_catalog(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'service_requests_symptom_id_fkey') then
    alter table service_requests
      add constraint service_requests_symptom_id_fkey
      foreign key (symptom_id) references symptoms(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_price_proposals_catalog_id_fkey') then
    alter table job_price_proposals
      add constraint job_price_proposals_catalog_id_fkey
      foreign key (catalog_id) references service_catalog(id) on delete set null;
  end if;
end $$;

create index if not exists service_catalog_category_idx on service_catalog(category_id);
create index if not exists service_catalog_active_idx on service_catalog(active);
create index if not exists pricing_rules_lookup_idx on pricing_rules(kind, scope, active);
create index if not exists symptoms_category_idx on symptoms(category_id);
create index if not exists price_benchmarks_lookup_idx on price_benchmarks(category_id, district_id, problem_type);
