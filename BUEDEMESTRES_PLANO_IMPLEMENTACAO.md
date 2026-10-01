# BUÉ DE MESTRES — Especificação Técnica e Plano de Implementação

> Documento para o agente de desenvolvimento (IDE). Ler na íntegra antes de escrever código.
> Idioma da interface: **Português (Moçambique)**. Moeda: **MZN**. Fuso: **Africa/Maputo**.

---

## 0. INSTRUÇÕES PARA O AGENTE

1. Trabalhar **fase a fase** (secção 9). Não avançar para a fase seguinte sem cumprir os critérios de aceitação da actual.
2. Cada fase termina com: código a compilar, `npm run lint` e `npm run typecheck` limpos, migrations aplicadas e commit próprio (`feat(fase-N): ...`).
3. Toda a lógica de dinheiro (carteira, planos, destaques, comissões) vive em **funções SQL transaccionais** (secção 4.4). Nunca calcular saldo no frontend.
4. Toda a tabela tem **RLS activo**. Nenhuma tabela fica acessível sem política explícita.
5. Validar toda a entrada com **zod** (cliente e servidor). Telefones no formato `+258 8X XXX XXXX`.
6. Textos de interface em português de Moçambique (ex.: "telemóvel", "bairro", "carregar saldo").
7. Não inventar endpoints de pagamento. Implementar a interface `PaymentProvider` (secção 7) e começar com o provedor `manual`, atrás de feature flag.
8. Não guardar ficheiros sensíveis (BI, selfie) em bucket público. Bucket privado + URLs assinadas de curta duração.
9. Em caso de dúvida de negócio, escolher a opção mais simples, registar a decisão em `docs/DECISIONS.md` e continuar.

---

## 1. VISÃO GERAL

**Bué de Mestres** é um marketplace de **prestadores de serviços** em Moçambique (mecânicos, explicadores, carpinteiros, electricistas, canalizadores, pedreiros, pintores, cabeleireiros, técnicos de informática, etc.).

**Problema:** encontrar um profissional fiável é difícil e feito por boca-a-boca; profissionais têm pouca visibilidade digital.

**Proposta:**
- **Cliente** procura, compara, contacta e avalia profissionais. Uso gratuito.
- **Profissional** cria perfil, é verificado, recebe pedidos e paga por planos e destaques.
- **Confiança** como diferencial: verificação de identidade, avaliações reais só após trabalho concluído, denúncias.

**Modelo de receita (o cliente nunca paga à plataforma):**
1. Planos de subscrição mensais para profissionais.
2. Destaques (topo da categoria, página inicial) e pesquisa prioritária.
3. Banners de anunciantes.
4. Afiliados: 10% sobre carregamentos dos referidos, durante 90 dias (custo de aquisição).

---

## 2. PERFIS DE UTILIZADOR

| Perfil | Pode |
|---|---|
| **Visitante** | Pesquisar, ver perfis públicos, ver avaliações |
| **Cliente** | Tudo do visitante + publicar pedidos, pedir orçamentos, conversar, avaliar, favoritar, denunciar |
| **Profissional** | Perfil profissional, serviços, portfólio, responder a pedidos, enviar orçamentos, conversar, carteira, planos, destaques, afiliado |
| **Admin** | Aprovar verificações, moderar, gerir categorias/planos/banners/afiliados, relatórios |

Um utilizador regista-se como cliente e pode **activar o perfil de profissional** depois (mesmo login).

---

## 3. STACK

- **Frontend/Backend:** Next.js 15 (App Router, TypeScript), Tailwind CSS, shadcn/ui, React Hook Form + zod.
- **Base de dados / Auth / Storage / Realtime:** Supabase (Postgres). Alternativa: Neon + Auth próprio (não usar; manter Supabase).
- **Pesquisa:** Postgres full-text (`portuguese`) + `pg_trgm` + `unaccent`.
- **Mapas:** opcional na fase 2 (Leaflet + OpenStreetMap, sem chave).
- **Jobs agendados:** Supabase `pg_cron` (expiração de planos/destaques/pedidos).
- **E-mail:** Resend. **Notificações:** in-app + e-mail; WhatsApp deep-link (`https://wa.me/`) para contacto.
- **PWA** (instalável) antes de qualquer app nativa.
- **Deploy:** Vercel. Ambientes: `dev`, `staging`, `prod`.
- **Testes:** Vitest (unidade), Playwright (fluxos críticos).

### Variáveis de ambiente (`.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
RESEND_API_KEY=
PAYMENT_PROVIDER=manual        # manual | mpesa | emola
MPESA_API_HOST=
MPESA_API_KEY=
MPESA_PUBLIC_KEY=
MPESA_SERVICE_PROVIDER_CODE=
EMOLA_API_HOST=
EMOLA_API_KEY=
WEBHOOK_SECRET=
```

---

## 4. ESQUEMA DE BASE DE DADOS (PostgreSQL / Supabase)

Aplicar como migrations numeradas em `supabase/migrations/`. Ordem: 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6.

### 4.1 Extensões e enums

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create type user_role           as enum ('client','provider','admin');
create type verification_status as enum ('none','pending','approved','rejected');
create type doc_type            as enum ('bi','passaporte','carta_conducao','dire');
create type request_status      as enum ('open','in_negotiation','accepted','in_progress','completed','cancelled','expired');
create type quote_status        as enum ('sent','accepted','rejected','withdrawn');
create type job_status          as enum ('scheduled','in_progress','completed','cancelled','disputed');
create type price_type          as enum ('fixed','hourly','from','quote');
create type tx_type             as enum ('topup','plan_purchase','boost_purchase','bonus','commission_payout','refund','adjustment');
create type tx_status           as enum ('pending','completed','failed','reversed');
create type payment_method      as enum ('mpesa','emola','bank_transfer','manual');
create type payment_status      as enum ('pending','completed','failed','expired');
create type boost_type          as enum ('featured','priority_search');
create type sub_status          as enum ('active','expired','cancelled');
create type report_status       as enum ('open','reviewing','resolved','dismissed');
create type report_target       as enum ('provider','review','message','request');
create type commission_status   as enum ('pending','paid');
```

### 4.2 Tabelas base

```sql
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

-- Perfis (1:1 com auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
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
```

### 4.3 Pedidos, orçamentos, trabalhos, chat, avaliações

```sql
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
```

### 4.4 Carteira, pagamentos, planos, destaques, afiliados

```sql
create table wallets (
  profile_id uuid primary key references profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

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
```

### 4.5 Funções e triggers

```sql
-- updated_at genérico
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_upd  before update on profiles          for each row execute function set_updated_at();
create trigger trg_provider_upd  before update on provider_profiles for each row execute function set_updated_at();
create trigger trg_requests_upd  before update on service_requests  for each row execute function set_updated_at();

-- Criar perfil + carteira ao registar
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ref uuid;
begin
  insert into profiles(id, full_name, email, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          new.email,
          new.raw_user_meta_data->>'phone');
  insert into wallets(profile_id) values (new.id);

  -- afiliado: código passado no signup
  select id into v_ref from profiles
   where referral_code = upper(new.raw_user_meta_data->>'referral_code');
  if v_ref is not null and v_ref <> new.id then
    update profiles set referred_by = v_ref where id = new.id;
    insert into referrals(referrer_id, referred_id) values (v_ref, new.id);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- Documento de pesquisa do profissional
create or replace function refresh_provider_search(p_id uuid) returns void
language plpgsql as $$
begin
  update provider_profiles pp set search_document =
    setweight(to_tsvector('portuguese', unaccent(coalesce(pp.business_name,''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(pp.headline,''))), 'B') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(pp.bio,''))), 'C') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce((
      select string_agg(s.title || ' ' || coalesce(s.description,''), ' ')
      from provider_services s where s.provider_id = pp.profile_id and s.is_active), ''))), 'B')
  where pp.profile_id = p_id;
end $$;

create or replace function trg_refresh_search() returns trigger language plpgsql as $$
begin
  perform refresh_provider_search(coalesce(new.provider_id, new.profile_id));
  return new;
end $$;
-- (agente: criar wrappers para provider_profiles (profile_id) e provider_services (provider_id))

-- Média de avaliações
create or replace function refresh_rating() returns trigger language plpgsql as $$
declare v_pid uuid := coalesce(new.provider_id, old.provider_id);
begin
  update provider_profiles set
    rating_avg = coalesce((select round(avg(rating)::numeric,2) from reviews where provider_id=v_pid and not is_hidden),0),
    rating_count = (select count(*) from reviews where provider_id=v_pid and not is_hidden)
  where profile_id = v_pid;
  return null;
end $$;
create trigger trg_reviews_rating after insert or update or delete on reviews
for each row execute function refresh_rating();

-- Só avaliar job concluído do próprio cliente
create or replace function check_review_allowed() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from jobs j where j.id = new.job_id and j.client_id = new.client_id
                 and j.provider_id = new.provider_id and j.status = 'completed') then
    raise exception 'review_not_allowed';
  end if;
  return new;
end $$;
create trigger trg_review_check before insert on reviews
for each row execute function check_review_allowed();

-- Contador de trabalhos concluídos
create or replace function on_job_completed() returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at = now();
    update provider_profiles set jobs_completed = jobs_completed + 1 where profile_id = new.provider_id;
  end if;
  return new;
end $$;
create trigger trg_job_completed before update on jobs
for each row execute function on_job_completed();

-- ===== CARTEIRA (única porta de entrada para mexer em saldo) =====
create or replace function wallet_apply(
  p_profile uuid, p_type tx_type, p_amount numeric, p_desc text,
  p_payment uuid default null, p_meta jsonb default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_id uuid;
begin
  select balance into v_bal from wallets where profile_id = p_profile for update;
  if v_bal is null then raise exception 'wallet_not_found'; end if;
  if v_bal + p_amount < 0 then raise exception 'insufficient_funds'; end if;
  update wallets set balance = balance + p_amount, updated_at = now() where profile_id = p_profile;
  insert into wallet_transactions(profile_id,type,amount,balance_after,description,payment_id,meta)
  values (p_profile,p_type,p_amount,v_bal+p_amount,p_desc,p_payment,p_meta) returning id into v_id;
  return v_id;
end $$;

-- Confirmar pagamento (chamado por webhook ou admin) — idempotente
create or replace function complete_payment(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pay payments; v_ref referrals; v_commission numeric;
begin
  select * into v_pay from payments where id = p_payment for update;
  if v_pay.status = 'completed' then return; end if;
  update payments set status='completed', completed_at=now() where id = p_payment;
  perform wallet_apply(v_pay.profile_id,'topup',v_pay.amount,'Carregamento de saldo',p_payment);

  select * into v_ref from referrals
   where referred_id = v_pay.profile_id and commission_until > now();
  if found then
    v_commission := round(v_pay.amount * 0.10, 2);
    insert into affiliate_commissions(referrer_id, referred_id, payment_id, amount)
    values (v_ref.referrer_id, v_pay.profile_id, p_payment, v_commission)
    on conflict (payment_id) do nothing;
  end if;
end $$;

-- Comprar plano (debita carteira e activa subscrição)
create or replace function purchase_plan(p_provider uuid, p_plan int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_plan plans; v_sub uuid;
begin
  select * into v_plan from plans where id = p_plan and is_active;
  if not found then raise exception 'plan_not_found'; end if;
  perform wallet_apply(p_provider,'plan_purchase',-v_plan.price,'Plano '||v_plan.name);
  update subscriptions set status='cancelled' where provider_id=p_provider and status='active';
  insert into subscriptions(provider_id,plan_id,ends_at)
  values (p_provider,p_plan,now()+make_interval(days=>v_plan.duration_days)) returning id into v_sub;
  if v_plan.featured_days_included > 0 then
    insert into boosts(provider_id,type,ends_at,price_paid)
    values (p_provider,'featured',now()+make_interval(days=>v_plan.featured_days_included),0);
  end if;
  return v_sub;
end $$;

-- Comprar destaque / pesquisa prioritária
create or replace function purchase_boost(p_provider uuid, p_type boost_type, p_days int, p_category int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_price numeric; v_id uuid;
begin
  select price into v_price from boost_prices where type=p_type and days=p_days;
  if v_price is null then raise exception 'boost_price_not_found'; end if;
  perform wallet_apply(p_provider,'boost_purchase',-v_price,'Destaque '||p_type||' '||p_days||'d');
  insert into boosts(provider_id,type,category_id,ends_at,price_paid)
  values (p_provider,p_type,p_category,now()+make_interval(days=>p_days),v_price) returning id into v_id;
  return v_id;
end $$;

-- Pesquisa pública de profissionais
create or replace function search_providers(
  p_q text default null, p_category int default null, p_district int default null,
  p_province smallint default null, p_min_rating numeric default 0,
  p_verified_only boolean default false, p_limit int default 20, p_offset int default 0
) returns table (
  profile_id uuid, slug text, business_name text, headline text, rating_avg numeric,
  rating_count int, verified boolean, is_featured boolean, is_priority boolean, rank real
) language sql stable as $$
  select pp.profile_id, pp.slug, pp.business_name, pp.headline, pp.rating_avg, pp.rating_count,
         (pp.verification='approved') as verified,
         exists(select 1 from boosts b where b.provider_id=pp.profile_id and b.type='featured'
                and b.ends_at>now() and (b.category_id is null or b.category_id=p_category)) as is_featured,
         exists(select 1 from boosts b where b.provider_id=pp.profile_id and b.type='priority_search'
                and b.ends_at>now()) as is_priority,
         case when p_q is null or p_q='' then 0
              else ts_rank(pp.search_document, websearch_to_tsquery('portuguese', unaccent(p_q))) end as rank
  from provider_profiles pp
  left join districts d on d.id = pp.district_id
  where pp.is_published
    and (p_category is null or exists(select 1 from provider_categories pc
                                     where pc.provider_id=pp.profile_id and pc.category_id=p_category))
    and (p_district is null or pp.district_id = p_district)
    and (p_province is null or d.province_id = p_province)
    and pp.rating_avg >= p_min_rating
    and (not p_verified_only or pp.verification='approved')
    and (p_q is null or p_q='' or pp.search_document @@ websearch_to_tsquery('portuguese', unaccent(p_q))
         or pp.business_name % p_q)
  order by is_featured desc, is_priority desc, rank desc, pp.rating_avg desc, pp.jobs_completed desc
  limit p_limit offset p_offset;
$$;
```

### 4.6 Jobs agendados (`pg_cron`)

```sql
-- de hora a hora
select cron.schedule('expire-subscriptions','0 * * * *',
  $$update subscriptions set status='expired' where status='active' and ends_at < now()$$);
select cron.schedule('expire-requests','15 * * * *',
  $$update service_requests set status='expired' where status='open' and expires_at < now()$$);
-- diário: lembrar planos a expirar em 3 dias (inserir em notifications)
```

### 4.7 Row Level Security (regras)

Activar `alter table ... enable row level security` em **todas** as tabelas. Políticas mínimas:

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `provinces`, `districts`, `categories`, `plans`, `boost_prices` | público | só admin |
| `profiles` | próprio + admin; campos públicos via view `public_profiles` | próprio (sem alterar `role` nem `referred_by`) |
| `provider_profiles` | público se `is_published`; próprio sempre | próprio; `verification` só admin/funções |
| `provider_services`, `provider_media`, `provider_categories` | público se o profissional está publicado | dono |
| `verification_documents` | dono + admin | dono insere; só admin altera `status` |
| `service_requests` | dono; profissionais vêem `open` na sua categoria/zona | dono |
| `quotes` | autor + dono do pedido | profissional autor (apenas com subscrição/quota) |
| `jobs`, `conversations`, `messages` | só participantes | participantes |
| `reviews` | público (não ocultas) | cliente autor (trigger valida job concluído); `provider_reply` só o profissional |
| `wallets`, `wallet_transactions`, `payments` | próprio + admin | **sem escrita directa**; só via funções `security definer` |
| `subscriptions`, `boosts` | dono + admin | só via funções |
| `referrals`, `affiliate_commissions` | referrer + admin | só via funções/admin |
| `notifications` | dono | sistema; dono pode marcar lida |
| `audit_logs` | admin | sistema |

Storage:
- Buckets **públicos**: `avatars`, `portfolio`, `request-media`, `banners`.
- Buckets **privados**: `verification` (BI/selfie), `payment-proofs`. Acesso por URL assinada (60 s) e só para dono/admin.

### 4.8 Seeds

**Províncias (11):** Maputo Cidade, Maputo Província, Gaza, Inhambane, Sofala, Manica, Tete, Zambézia, Nampula, Cabo Delgado, Niassa.
**Distritos/cidades:** iniciar com Maputo Cidade (KaMpfumo, Nlhamankulu, KaMaxakeni, KaMavota, KaMubukwana, KaTembe, KaNyaka), Matola, Boane, Marracuene, Beira, Nampula, Quelimane, Tete, Chimoio, Xai-Xai, Inhambane, Pemba, Lichinga. Estrutura permite expandir.

**Categorias iniciais (pai → filhos):**
- Automóvel: Mecânico, Electricista auto, Chapeiro/Pintor auto, Pneus e balanceamento, Lavagem
- Construção e Reparações: Pedreiro, Carpinteiro, Canalizador, Electricista, Pintor, Serralheiro, Ladrilhador, Soldador, Vidraceiro
- Educação: Explicador (Matemática, Física, Química, Português, Inglês), Aulas de música, Preparação de exames
- Tecnologia: Técnico de computadores, Técnico de telemóveis, Redes e CCTV, Design e Web
- Casa e Limpeza: Limpezas, Jardinagem, Mudanças, Dedetização
- Beleza e Bem-estar: Cabeleireiro, Barbeiro, Manicure, Maquilhagem, Massagens
- Eventos: Fotografia e vídeo, DJ e som, Decoração, Catering, Bolos
- Frio e Electrodomésticos: Refrigeração, Reparação de electrodomésticos, Painéis solares
- Moda: Alfaiate/Costureira, Sapateiro

**Planos iniciais (valores configuráveis, a validar com o mercado):**

| code | Nome | Preço/mês (MZN) | Serviços | Fotos | Categorias | Orçamentos/mês | Destaque incluído |
|---|---|---|---|---|---|---|---|
| free | Grátis | 0 | 3 | 5 | 1 | 5 | 0 |
| pro | Pro | 500 | 10 | 20 | 3 | 30 | 0 |
| premium | Premium | 1.500 | 30 | 50 | 5 | ilimitado | 3 dias |

**Preços de destaque (configuráveis):** featured 3d/7d/30d e priority_search 7d/30d.

---

## 5. REGRAS DE NEGÓCIO

1. **Registo:** e-mail + palavra-passe (ou telefone + OTP na fase 8). Telefone obrigatório para profissionais.
2. **Activar perfil profissional:** cria `provider_profiles` (não publicado). Publica-se só depois de perfil mínimo completo: nome, categoria, distrito, ≥1 serviço, telefone.
3. **Verificação:** gratuita. Profissional envia documento (BI, passaporte, carta de condução ou DIRE, em validade) + selfie a segurar o documento. Admin aprova/rejeita com motivo em até 48h. Selo "Verificado" só com `approved`. Profissionais não verificados podem publicar, mas aparecem abaixo dos verificados e sem selo.
4. **Pedidos:** cliente publica pedido (aberto, visível a profissionais da categoria/zona) **ou** pedido directo a um profissional. Expira em 14 dias.
5. **Orçamentos:** limitados por plano (`monthly_quotes`). Um orçamento por profissional por pedido. Cliente aceita um → cria `job`, restantes ficam `rejected`.
6. **Chat:** abre-se conversa ao contactar ou ao enviar orçamento. Botão "WhatsApp" opcional no perfil.
7. **Avaliações:** só após `job.status = completed`, uma por trabalho, 1–5 estrelas + comentário. Profissional pode responder uma vez. Admin pode ocultar (`is_hidden`).
8. **Carteira:** saldo em MZN, mínimo de carregamento 50 MZN. Usado para planos e destaques. Sem reembolso de carregamentos (registar nos Termos).
9. **Planos:** 30 dias, um activo por profissional. Ao expirar volta a "Grátis" (limites do plano grátis; conteúdo excedente fica oculto, não apagado).
10. **Destaques:** `featured` (topo da categoria/página inicial) e `priority_search` (sobe na pesquisa). Ordenação: destaque > prioridade > relevância > avaliação > trabalhos.
11. **Afiliados:** 10% sobre cada carregamento dos referidos durante 90 dias. Comissões `pending` até ao pagamento manual mensal por admin (mínimo 200 MZN).
12. **Moderação:** denúncias por perfil, avaliação, mensagem ou pedido. 3 denúncias procedentes → suspensão automática do perfil para revisão.
13. **Anti-fuga:** não mostrar telefone/WhatsApp de profissionais ao visitante anónimo; exigir login para ver contacto.
14. **RGPD/Privacidade:** documentos de identidade só acessíveis a admins; apagar ficheiros de verificação rejeitados após 30 dias.

---

## 6. ESTRUTURA DO PROJECTO

```
buedemestres/
├─ docs/                    # DECISIONS.md, API.md, BRANDING.md
├─ supabase/
│  ├─ migrations/           # 0001_extensions_enums.sql … 
│  └─ seed.sql
├─ src/
│  ├─ app/
│  │  ├─ (public)/          # home, /categoria/[slug], /profissional/[slug], /pesquisa
│  │  ├─ (auth)/            # entrar, registar, recuperar
│  │  ├─ (client)/          # /painel, /pedidos, /mensagens, /favoritos
│  │  ├─ (provider)/        # /pro/perfil, /pro/servicos, /pro/pedidos, /pro/carteira,
│  │  │                     # /pro/planos, /pro/destaques, /pro/verificacao, /pro/afiliados
│  │  ├─ (admin)/           # /admin/verificacoes, /moderacao, /categorias, /planos,
│  │  │                     # /pagamentos, /afiliados, /banners, /relatorios
│  │  └─ api/
│  │     ├─ webhooks/payments/route.ts
│  │     └─ cron/route.ts
│  ├─ components/           # ui/ (shadcn), providers/, requests/, chat/, wallet/
│  ├─ lib/
│  │  ├─ supabase/          # client.ts, server.ts, admin.ts
│  │  ├─ payments/          # types.ts, manual.ts, mpesa.ts, emola.ts, index.ts
│  │  ├─ validators/        # zod schemas
│  │  └─ utils/             # format-mzn.ts, phone.ts, slug.ts
│  └─ types/                # database.types.ts (gerado)
└─ tests/                   # unit/ e e2e/
```

Gerar tipos: `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts`.

---

## 7. PAGAMENTOS

Interface obrigatória (`src/lib/payments/types.ts`):

```ts
export interface PaymentProvider {
  name: 'manual' | 'mpesa' | 'emola';
  initiate(input: { paymentId: string; amount: number; msisdn?: string }): Promise<{ providerRef?: string; instructions?: string }>;
  verifyWebhook(req: Request): Promise<{ providerRef: string; paymentId: string; status: 'completed' | 'failed' } | null>;
}
```

- **manual** (fase 5, activo por defeito): utilizador paga por M-Pesa/transferência, envia comprovativo (upload para `payment-proofs`), admin confirma em `/admin/pagamentos` → chama `complete_payment`. Comprovativo válido 48h.
- **mpesa / emola** (fase 8): implementar contra a documentação oficial das operadoras (Vodacom M-Pesa Moçambique e Movitel e-Mola). O agente **não deve assumir endpoints nem formatos**; ler a documentação fornecida pelo utilizador e manter chaves só em variáveis de ambiente.
- **Webhook:** verificar assinatura/segredo, ser **idempotente** (`payments.provider_ref` único), responder rápido e chamar `complete_payment` no servidor com service role.
- Nunca confiar em estado de pagamento vindo do cliente.

---

## 8. PÁGINAS E FLUXOS

**Públicas:** Home (pesquisa, categorias, profissionais em destaque, banners), Resultados (filtros: categoria, província, distrito, avaliação, verificado; ordenação), Perfil do profissional (sobre, serviços com preço, portfólio, avaliações, botão "Pedir orçamento"/"Conversar"), Como funciona, Termos, Privacidade, Ajuda.

**Cliente:** Painel, Novo pedido (categoria → detalhes → fotos → localização), Meus pedidos (orçamentos recebidos, aceitar), Mensagens, Meus trabalhos (marcar concluído, avaliar), Favoritos, Definições.

**Profissional:** Onboarding em passos (dados → categorias → serviços → fotos → verificação → publicar), Pedidos disponíveis (filtro por categoria/zona), Meus orçamentos, Agenda de trabalhos, Carteira (saldo, carregar, extracto), Planos, Destaques, Afiliados (código, link, comissões), Avaliações (responder).

**Admin:** Fila de verificações (ver documento, aprovar/rejeitar com motivo), Denúncias, Pagamentos pendentes (manual), Pagamento de comissões, Categorias/Planos/Preços de destaque, Banners, Utilizadores (suspender), Relatórios (registos, profissionais activos, receita, pedidos, conversão).

---

## 9. PLANO DE IMPLEMENTAÇÃO POR FASES

### Fase 0 — Fundação
- Criar repositório, Next.js + TS + Tailwind + shadcn/ui, ESLint/Prettier, Husky (lint + typecheck no commit).
- Projecto Supabase, migrations 4.1–4.6, seeds 4.8, RLS 4.7, buckets.
- Clientes Supabase (browser/server/admin), gerar tipos, layout base, tema (paleta a definir em `docs/BRANDING.md`), i18n pt-MZ.
- CI (lint, typecheck, testes) e deploy de `staging` na Vercel.
- **Aceitação:** `npm run build` passa; migrations aplicam do zero; login de teste cria `profiles` + `wallets` via trigger.

### Fase 1 — Autenticação e perfis
- Registo/entrada/recuperar palavra-passe; campo `referral_code` no registo (URL `?ref=CODIGO` guarda em cookie).
- Perfil do utilizador (editar nome, telefone, avatar, distrito).
- Activar perfil profissional; onboarding em passos; slug único.
- Upload de verificação (bucket privado) e fila admin (aprovar/rejeitar, motivo, notificação).
- **Aceitação:** fluxo completo cliente → profissional → verificação aprovada pelo admin; RLS impede ver documentos de outros; testes E2E do fluxo.

### Fase 2 — Catálogo e pesquisa
- CRUD de serviços e portfólio (limites por plano).
- Página pública do profissional (SEO: metadata, JSON-LD `LocalBusiness`, sitemap).
- Home, listagem por categoria e pesquisa (`search_providers`), filtros e paginação; favoritos.
- **Aceitação:** pesquisa com acentos ("electricista" = "eletricista"), filtros funcionais, tempo de resposta < 500 ms com 10.000 profissionais de seed; Lighthouse ≥ 90 em mobile na home.

### Fase 3 — Pedidos, orçamentos, chat
- Pedido público e directo; listagem para profissionais por categoria/zona.
- Orçamentos (respeitar quota do plano); aceitar → criar `job`.
- Chat em tempo real (Supabase Realtime), anexos, indicador de não lidas; notificações in-app + e-mail.
- Botão WhatsApp (deep-link) no perfil e no chat.
- **Aceitação:** dois utilizadores conversam em tempo real; só participantes leem mensagens (teste de RLS); expiração de pedidos por cron.

### Fase 4 — Trabalhos e avaliações
- Estados do job (agendado → em curso → concluído/cancelado); confirmar conclusão.
- Avaliação após concluído; resposta do profissional; média e contagem por trigger.
- Denúncias e painel de moderação.
- **Aceitação:** impossível avaliar sem job concluído; média correcta após inserir/ocultar avaliação.

### Fase 5 — Carteira, planos, destaques (modo manual)
- Carregar saldo: criar `payments`, upload de comprovativo, fila admin, `complete_payment`.
- Extracto (`wallet_transactions`); comprar plano (`purchase_plan`) e destaques (`purchase_boost`).
- Aplicar limites de plano na UI e no servidor; expiração por cron; aviso 3 dias antes.
- **Aceitação:** saldo nunca negativo (teste de concorrência com 2 compras simultâneas); expirar plano repõe limites do Grátis; ordenação da pesquisa respeita destaques.

### Fase 6 — Afiliados e banners
- Código/link de afiliado, painel de comissões, geração via `complete_payment`, pagamento mensal por admin (marcar `paid`).
- Gestão de banners com agendamento e posições.
- **Aceitação:** comissão só nos primeiros 90 dias e só uma vez por pagamento (idempotente).

### Fase 7 — Painel admin e relatórios
- Utilizadores (suspender/reactivar), categorias, planos, preços de destaque, auditoria (`audit_logs`).
- Relatórios: registos por dia, profissionais activos/verificados, pedidos, orçamentos, receita por tipo, conversão pedido → job.
- **Aceitação:** todas as acções de admin geram registo em `audit_logs`.

### Fase 8 — Pagamentos automáticos, PWA e notificações
- Implementar `mpesa` e `emola` atrás da interface `PaymentProvider` e webhook idempotente (com a documentação oficial).
- PWA (manifest, service worker, instalável), OTP por SMS/WhatsApp (se disponível), notificações push web.
- **Aceitação:** carregamento automático credita saldo em segundos; reenvio do mesmo webhook não duplica crédito.

### Fase 9 — Endurecimento e lançamento
- Rate limiting (registo, login, mensagens, pedidos), CAPTCHA no registo, moderação de imagens, cópias de segurança.
- Testes de carga básicos, revisão de segurança (RLS, buckets, segredos), logs e alertas (Sentry).
- Páginas legais (Termos, Privacidade, Política de reembolsos), conteúdo "Como funciona".
- Lançamento piloto: 2 cidades (Maputo/Matola), 3–4 categorias (mecânico, explicador, carpinteiro, electricista), meta de 200 profissionais verificados.
- **Aceitação:** checklist de segurança assinada; zero tabelas sem RLS (`select tablename from pg_tables where schemaname='public' and rowsecurity=false;` devolve vazio).

---

## 10. REQUISITOS NÃO FUNCIONAIS

- **Mobile-first:** a maioria dos utilizadores usa telemóvel com dados limitados. Imagens comprimidas no cliente (máx. 1 MB, WebP), `next/image`, listas paginadas, PWA.
- **Desempenho:** LCP < 2,5 s em 4G; pesquisa < 500 ms.
- **Segurança:** RLS em tudo; service role só no servidor; validação zod; sanitizar textos; URLs assinadas para ficheiros privados; segredos só em variáveis de ambiente.
- **Acessibilidade:** contraste AA, navegação por teclado, textos alternativos.
- **Observabilidade:** Sentry, logs de webhooks, `audit_logs`.
- **SEO:** URLs limpas (`/mecanico/maputo`), sitemap dinâmico, metadata por categoria/cidade.

---

## 11. TESTES OBRIGATÓRIOS

**Unidade (Vitest):** formatação MZN e telefone, slug, validadores zod, regras de limites de plano.
**SQL/RLS:** utilizador A não lê dados privados de B; cliente não escreve em `wallets`; avaliação sem job concluído falha; `wallet_apply` rejeita saldo negativo; `complete_payment` é idempotente; comissão só dentro dos 90 dias.
**E2E (Playwright):** registo → activar profissional → verificação → publicar → cliente pesquisa → pedido → orçamento → aceitar → concluir → avaliar; carregar saldo (manual) → comprar plano → aparece em destaque.

---

## 12. DEFINIÇÃO DE PRONTO (por tarefa)

- Compila, lint e typecheck sem erros.
- RLS e validações cobertas por teste.
- Sem segredos no repositório.
- UI responsiva (360 px de largura) e em português de Moçambique.
- Migration incluída e reversível.
- Decisões relevantes registadas em `docs/DECISIONS.md`.

---

## 13. BACKLOG PÓS-LANÇAMENTO

Agendamento com calendário, pagamento do serviço dentro da plataforma (escrow), cartão de fidelidade, selo "Top Mestre", perfis de empresa com equipa, IA para descrever o pedido a partir de fotos/áudio e sugerir categoria e preço, tradução para línguas locais, app nativa (React Native), API pública para parceiros.
