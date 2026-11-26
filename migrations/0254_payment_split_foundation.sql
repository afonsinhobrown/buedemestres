-- 0254: fundação do novo fluxo de pagamentos e preços
-- Aditivo. Não substitui job_payments, job_addenda nem job_status.

-- ===== 1. jobs: preço, fase, PIN e snapshot =====
alter table jobs
  add column if not exists pricing_mode text,
  add column if not exists catalog_id uuid,
  add column if not exists travel_fee numeric(12,2),
  add column if not exists travel_distance_km numeric(10,2),
  add column if not exists travel_credit numeric(12,2) not null default 0,
  add column if not exists labor_amount numeric(12,2),
  add column if not exists parts_amount numeric(12,2),
  add column if not exists job_phase text,
  add column if not exists completion_pin_hash text,
  add column if not exists pin_expires_at timestamptz,
  add column if not exists pin_attempts smallint not null default 0,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists service_paid_at timestamptz,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists settled_at timestamptz,
  add column if not exists provider_payout_final numeric(12,2);

update jobs
   set job_phase = status::text
 where job_phase is null;

-- ===== 2. service_requests: modo de preço e triagem =====
alter table service_requests
  add column if not exists pricing_mode text,
  add column if not exists symptom_id uuid,
  add column if not exists triage_summary text,
  add column if not exists safety_ack boolean not null default false;

-- ===== 3. job_payments: breakdown de mão de obra/peças =====
alter table job_payments
  add column if not exists labor_amount numeric(12,2),
  add column if not exists parts_amount numeric(12,2),
  add column if not exists travel_credit numeric(12,2) not null default 0,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;

update job_payments
   set labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0)
 where labor_amount is null or parts_amount is null;

-- ===== 4. job_price_proposals: breakdown e faixa =====
alter table job_price_proposals
  add column if not exists labor_amount numeric(12,2),
  add column if not exists parts_amount numeric(12,2),
  add column if not exists catalog_id uuid,
  add column if not exists range_min numeric(12,2),
  add column if not exists range_max numeric(12,2),
  add column if not exists within_range boolean,
  add column if not exists travel_credit numeric(12,2) not null default 0;

update job_price_proposals
   set labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0)
 where labor_amount is null or parts_amount is null;

-- ===== 5. job_addenda: tipo e breakdown (mantém o fluxo actual) =====
alter table job_addenda
  add column if not exists kind text not null default 'extra',
  add column if not exists labor_amount numeric(12,2),
  add column if not exists parts_amount numeric(12,2),
  add column if not exists evidence_url text,
  add column if not exists review_status text not null default 'none';

update job_addenda
   set labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0)
 where labor_amount is null or parts_amount is null;

-- ===== 6. job_refunds: origem do reembolso =====
alter table job_refunds
  add column if not exists source text not null default 'service',
  add column if not exists source_id uuid;

-- ===== 7. request_media: foto, vídeo e áudio =====
alter table request_media
  add column if not exists kind text not null default 'photo',
  add column if not exists duration_s smallint,
  add column if not exists transcript text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ===== 8. job_charges: deslocação e diferença de reclassificação =====
-- Não é um segundo pagamento do serviço. O serviço continua em job_payments.
create table if not exists job_charges (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null check (kind in ('travel', 'reclassification')),
  amount numeric(12,2) not null check (amount > 0),
  labor_amount numeric(12,2),
  parts_amount numeric(12,2),
  commission_rate numeric(5,4),
  commission_amount numeric(12,2) not null default 0,
  provider_payout numeric(12,2),
  status escrow_status not null default 'pending_payment',
  method payment_method not null default 'manual',
  msisdn text,
  provider_ref text unique,
  provider_payment_id text,
  checkout_url text,
  original_job_payment_id uuid references job_payments(id) on delete set null,
  original_amount numeric(12,2),
  new_total numeric(12,2),
  evidence_url text,
  review_status text not null default 'none',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  held_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz
);

create index if not exists job_charges_job_idx on job_charges(job_id);
create index if not exists job_charges_status_idx on job_charges(status);
create index if not exists job_charges_kind_idx on job_charges(kind);

-- ===== 9. platform_revenue: ligar ao encargo que gerou a receita =====
alter table platform_revenue
  add column if not exists job_charge_id uuid,
  add column if not exists job_addenda_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'platform_revenue_job_charge_id_fkey'
  ) then
    alter table platform_revenue
      add constraint platform_revenue_job_charge_id_fkey
      foreign key (job_charge_id) references job_charges(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'platform_revenue_job_addenda_id_fkey'
  ) then
    alter table platform_revenue
      add constraint platform_revenue_job_addenda_id_fkey
      foreign key (job_addenda_id) references job_addenda(id) on delete set null;
  end if;
end $$;

-- ===== 10. índices de apoio =====
create index if not exists jobs_catalog_idx on jobs(catalog_id);
create index if not exists service_requests_symptom_idx on service_requests(symptom_id);
create index if not exists job_price_proposals_catalog_idx on job_price_proposals(catalog_id);
create index if not exists job_refunds_source_idx on job_refunds(source, source_id);
