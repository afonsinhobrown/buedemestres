-- 0213: preços aprovados, créditos, trial, empresas, QR, termos e taxas globais.

-- ===== Taxas globais (editáveis pela administração) =====
insert into app_settings(key, value) values
  ('commission_rate', '0.20'::jsonb),
  ('trial_days', '15'::jsonb),
  ('trial_services', '5'::jsonb),
  ('trial_commission_rate', '0.10'::jsonb),
  ('loyalty_master_threshold', '10'::jsonb),
  ('loyalty_client_threshold', '11'::jsonb),
  ('loyalty_discount_pct', '10'::jsonb),
  ('company_license_extra', '200'::jsonb)
on conflict (key) do nothing;

-- ===== Planos =====
alter table plans
  add column if not exists audience text not null default 'individual',
  add column if not exists max_masters int not null default 1,
  add column if not exists credit_price numeric(12,2) not null default 300;

update plans set commission_rate = 0.20;

update plans
   set name = 'Básico', price = 1000, max_services = 5, max_photos = 3,
       max_categories = 1, monthly_quotes = 5, weekend_priority = false,
       recurring_visibility = false, rating_boost = 0, credit_price = 300,
       audience = 'individual', max_masters = 1, badge = null, is_active = true
 where code = 'basic';

update plans
   set name = 'Standard', price = 2500, max_services = 15, max_photos = 15,
       max_categories = 3, monthly_quotes = 30, weekend_priority = true,
       recurring_visibility = true, rating_boost = 0.20, credit_price = 250,
       audience = 'individual', max_masters = 1, badge = 'STANDARD', is_active = true
 where code = 'standard';

update plans
   set name = 'Premium', price = 5000, max_services = 40, max_photos = 40,
       max_categories = 5, monthly_quotes = null, weekend_priority = true,
       recurring_visibility = true, rating_boost = 0.50, credit_price = 200,
       audience = 'individual', max_masters = 1, badge = 'PREMIUM', is_active = true
 where code = 'premium';

insert into plans(code, name, price, duration_days, max_services, max_photos, max_categories,
                  can_quote_unlimited, monthly_quotes, featured_days_included, badge,
                  sort_order, commission_rate, audience, max_masters, credit_price,
                  weekend_priority, recurring_visibility, rating_boost)
values
  ('company_basic', 'Básico Empresa', 2200, 30, 10, 10, 3, false, 30, 0, 'EMPRESA',
   5, 0.20, 'company', 5, 350, false, true, 0.10),
  ('company_standard', 'Standard Empresa', 5200, 30, 30, 30, 5, false, 60, 0, 'EMPRESA',
   6, 0.20, 'company', 15, 300, true, true, 0.30),
  ('company_premium', 'Premium Empresa', 10200, 30, 80, 80, 10, true, null, 0, 'EMPRESA',
   7, 0.20, 'company', 40, 250, true, true, 0.50)
on conflict (code) do update set
  name = excluded.name, price = excluded.price, max_services = excluded.max_services,
  max_photos = excluded.max_photos, max_categories = excluded.max_categories,
  monthly_quotes = excluded.monthly_quotes, commission_rate = excluded.commission_rate,
  audience = excluded.audience, max_masters = excluded.max_masters,
  credit_price = excluded.credit_price, weekend_priority = excluded.weekend_priority,
  recurring_visibility = excluded.recurring_visibility, rating_boost = excluded.rating_boost;

-- ===== Trial e créditos =====
alter table provider_profiles
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

update provider_profiles
   set trial_started_at = coalesce(trial_started_at, now()),
       trial_ends_at = coalesce(trial_ends_at, now() + interval '15 days')
 where trial_ends_at is null;

create table if not exists service_credits (
  provider_id uuid primary key references provider_profiles(profile_id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  credits int not null,
  amount numeric(12,2) not null default 0,
  kind text not null check (kind in ('purchase','consume','refund','bonus')),
  description text,
  created_at timestamptz not null default now()
);
create index if not exists credit_transactions_provider_idx on credit_transactions(provider_id, created_at desc);

create or replace function purchase_credits(p_provider uuid, p_credits int)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_price numeric;
  v_total numeric;
  v_balance int;
begin
  if auth.uid() is not null and p_provider <> auth.uid() then
    raise exception 'forbidden';
  end if;
  if p_credits <= 0 then raise exception 'invalid_credits'; end if;

  select pl.credit_price into v_price
    from subscriptions s
    join plans pl on pl.id = s.plan_id
   where s.provider_id = p_provider and s.status = 'active'
   limit 1;

  if v_price is null then
    select credit_price into v_price from plans where code = 'basic' and is_active;
  end if;
  v_price := coalesce(v_price, 300);
  v_total := round(v_price * p_credits, 2);

  perform wallet_apply(p_provider, 'plan_purchase', -v_total,
                       p_credits || ' crédito(s) de serviço');
  insert into service_credits(provider_id, balance) values (p_provider, p_credits)
  on conflict (provider_id) do update set balance = service_credits.balance + p_credits, updated_at = now()
  returning balance into v_balance;
  insert into credit_transactions(provider_id, credits, amount, kind, description)
  values (p_provider, p_credits, v_total, 'purchase', 'Compra de créditos');
  return v_balance;
end $$;

create or replace function consume_service_credit(p_provider uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if auth.uid() is not null and p_provider <> auth.uid() then
    raise exception 'forbidden';
  end if;
  update service_credits
     set balance = balance - 1, updated_at = now()
   where provider_id = p_provider and balance > 0
   returning balance into v_balance;
  if v_balance is null then return false; end if;
  insert into credit_transactions(provider_id, credits, amount, kind, description)
  values (p_provider, -1, 0, 'consume', 'Crédito consumido ao aceitar pedido');
  return true;
end $$;

-- ===== Empresas =====
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  legal_name text not null,
  trade_name text not null,
  nuit text not null unique,
  email text,
  phone text,
  address text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  verification text not null default 'pending' check (verification in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null,
  file_url text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists company_masters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  role text not null default 'master' check (role in ('owner','manager','master')),
  is_active boolean not null default true,
  is_available boolean not null default true,
  categories int[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (company_id, provider_id)
);

create table if not exists provider_penalties (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  kind text not null,
  amount numeric(12,2),
  reason text,
  applied_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table jobs add column if not exists company_id uuid references companies(id) on delete set null;

-- ===== QR por pedido =====
create table if not exists job_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  phase text not null check (phase in ('start','finish')),
  token text not null unique,
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  created_by uuid references profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists job_qr_tokens_job_idx on job_qr_tokens(job_id, phase, created_at desc);

-- ===== Termos e consentimento =====
create table if not exists terms_versions (
  id serial primary key,
  audience text not null check (audience in ('client','provider','company')),
  version text not null,
  title text not null,
  content text not null,
  effective_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (audience, version)
);

create table if not exists terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  terms_version_id int not null references terms_versions(id),
  accepted_at timestamptz not null default now(),
  email_opt_in boolean not null default false,
  ip text,
  user_agent text,
  unique (profile_id, terms_version_id)
);

insert into terms_versions(audience, version, title, content) values
  ('client', '1.0', 'Termos do Cliente',
   'A Bué de Mestres liga clientes a mestres. O pagamento é retido em escrow e libertado após confirmação do serviço. O cliente deve fornecer informação verdadeira, confirmar o serviço por QR e respeitar as regras de cancelamento. A plataforma cobra 20% de comissão ao mestre sobre o valor do serviço. Dados pessoais são tratados conforme a Política de Privacidade.'),
  ('provider', '1.0', 'Termos do Mestre',
   'O mestre compromete-se a usar a sua identidade real, comparecer com o mestre atribuído, iniciar e concluir o serviço com QR, e cumprir os prazos. A plataforma cobra 20% sobre o valor do serviço. O plano mensal ou créditos dão acesso a pedidos; o trial é de 15 dias e 5 serviços. O incumprimento pode gerar multa, suspensão ou eliminação. A disponibilidade de cada serviço deve ser ativada pelo próprio ou pela empresa.'),
  ('company', '1.0', 'Termos da Empresa',
   'A empresa declara que os documentos submetidos são verdadeiros e que os mestres associados prestam serviço sob a sua responsabilidade. Deve manter a disponibilidade de cada mestre/serviço atualizada e garantir que o mestre atribuído é o que comparece. A substituição não autorizada é punível com multa, suspensão ou eliminação. A licença empresarial é paga mensalmente e a plataforma cobra 20% sobre o valor do serviço.')
on conflict (audience, version) do nothing;

-- ===== Storage para documentos de empresa =====
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets(id, name, public) values ('company-documents','company-documents', true)
    on conflict (id) do nothing;
  end if;
end $$;

-- ===== RLS =====
alter table service_credits enable row level security;
alter table credit_transactions enable row level security;
alter table companies enable row level security;
alter table company_documents enable row level security;
alter table company_masters enable row level security;
alter table provider_penalties enable row level security;
alter table job_qr_tokens enable row level security;
alter table terms_versions enable row level security;
alter table terms_acceptances enable row level security;

create policy "credits_select_own" on service_credits for select to authenticated using (provider_id = auth.uid());
create policy "credit_tx_select_own" on credit_transactions for select to authenticated using (provider_id = auth.uid());

create policy "companies_select_authenticated" on companies for select to authenticated using (true);
create policy "companies_insert_owner" on companies for insert to authenticated with check (owner_id = auth.uid());
create policy "companies_update_owner" on companies for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "company_docs_select_member" on company_documents for select to authenticated
  using (exists (select 1 from companies c where c.id = company_id and c.owner_id = auth.uid())
         or exists (select 1 from company_masters cm where cm.company_id = company_documents.company_id and cm.provider_id = auth.uid()));
create policy "company_docs_insert_member" on company_documents for insert to authenticated
  with check (exists (select 1 from companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "company_masters_select_authenticated" on company_masters for select to authenticated using (true);
create policy "company_masters_write_manager" on company_masters for all to authenticated
  using (exists (select 1 from companies c where c.id = company_id and c.owner_id = auth.uid()) or provider_id = auth.uid())
  with check (exists (select 1 from companies c where c.id = company_id and c.owner_id = auth.uid()) or provider_id = auth.uid());

create policy "penalties_select_own" on provider_penalties for select to authenticated using (provider_id = auth.uid());

create policy "terms_versions_select_authenticated" on terms_versions for select to authenticated using (is_current);
create policy "terms_acceptances_select_own" on terms_acceptances for select to authenticated using (profile_id = auth.uid());
create policy "terms_acceptances_insert_own" on terms_acceptances for insert to authenticated with check (profile_id = auth.uid());

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    begin
      create policy "company_docs_storage_insert" on storage.objects for insert to authenticated
        with check (bucket_id = 'company-documents');
    exception when duplicate_object then null;
    end;
    begin
      create policy "company_docs_storage_select" on storage.objects for select to authenticated
        using (bucket_id = 'company-documents');
    exception when duplicate_object then null;
    end;
  end if;
end $$;
