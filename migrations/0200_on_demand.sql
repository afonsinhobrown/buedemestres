create extension if not exists postgis;

create type request_mode  as enum ('on_demand','quote');
create type urgency_level as enum ('sos','today','scheduled');
create type offer_status  as enum ('sent','viewed','accepted','declined','expired','cancelled');
create type escrow_status as enum ('pending_payment','held','released','refunded','partially_refunded','disputed');
create type payout_status as enum ('pending','processing','completed','failed');
create type kyc_stage     as enum ('draft','documents_submitted','auto_checks','manual_review','needs_info','approved','rejected','expired');

alter table service_requests
  add column mode request_mode not null default 'quote',
  add column urgency urgency_level not null default 'scheduled',
  add column location geography(Point,4326),
  add column location_note text,
  add column vehicle jsonb,
  add column search_radius_m int not null default 5000;

create index service_requests_loc_gix on service_requests using gist(location);

create table provider_presence (
  provider_id uuid primary key references provider_profiles(profile_id) on delete cascade,
  is_online boolean not null default false,
  location geography(Point,4326),
  heading smallint,
  accuracy_m int,
  categories int[] not null default '{}',
  active_job_id uuid,
  updated_at timestamptz not null default now()
);
create index provider_presence_gix on provider_presence using gist(location) where is_online;

create table request_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  provider_id uuid not null references provider_profiles(profile_id) on delete cascade,
  status offer_status not null default 'sent',
  round smallint not null default 1,
  distance_m int,
  eta_s int,
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz not null,
  unique (request_id, provider_id)
);
create index on request_offers(provider_id, status, expires_at);

alter table jobs
  add column price_estimate_min numeric(12,2),
  add column price_estimate_max numeric(12,2),
  add column price_proposed numeric(12,2),
  add column arrival_eta_s int,
  add column accepted_at timestamptz,
  add column arrived_at timestamptz,
  add column started_at timestamptz,
  add column confirm_deadline timestamptz,
  add column pickup_location geography(Point,4326);

create table job_price_proposals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  proposed_by uuid not null references profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now()
);

create table job_location_log (
  id bigserial primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  location geography(Point,4326) not null,
  recorded_at timestamptz not null default now()
);
create index on job_location_log(job_id, recorded_at);

alter table plans add column commission_rate numeric(5,4) not null default 0.1200;

create table job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references jobs(id),
  client_id uuid not null references profiles(id),
  provider_id uuid not null references provider_profiles(profile_id),
  amount numeric(12,2) not null check (amount > 0),
  commission_rate numeric(5,4) not null,
  commission_amount numeric(12,2) not null,
  provider_payout numeric(12,2) not null,
  method payment_method not null,
  msisdn text,
  status escrow_status not null default 'pending_payment',
  provider_ref text unique,
  held_at timestamptz,
  release_after timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  ticket_id uuid,
  created_at timestamptz not null default now(),
  check (commission_amount + provider_payout = amount)
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(profile_id),
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  msisdn text not null,
  status payout_status not null default 'pending',
  provider_ref text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table platform_revenue (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  amount numeric(12,2) not null,
  job_id uuid references jobs(id),
  profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on platform_revenue(kind, created_at);

-- KYC
alter table verification_documents
  add column stage kyc_stage not null default 'documents_submitted',
  add column ocr_data jsonb,
  add column ocr_confidence numeric(4,3),
  add column face_match_score numeric(4,3),
  add column liveness_passed boolean,
  add column doc_number_hash text,
  add column face_hash text,
  add column provider_ref text,
  add column attempts smallint not null default 1;

create unique index verification_docnum_uq on verification_documents(doc_number_hash)
  where stage in ('documents_submitted','auto_checks','manual_review','needs_info','approved');

create table verification_events (
  id bigserial primary key,
  verification_id uuid not null references verification_documents(id) on delete cascade,
  stage kyc_stage not null,
  actor_id uuid references profiles(id),
  note text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on verification_events(verification_id, created_at);

create table verification_checks (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references verification_documents(id) on delete cascade,
  check_type text not null,
  passed boolean not null,
  score numeric(5,3),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Funções

create or replace function nearby_providers(p_request uuid, p_radius_m int, p_limit int default 10)
returns table (provider_id uuid, distance_m int, rating_avg numeric)
language sql stable security definer set search_path = public as $$
  select pr.provider_id,
         ST_Distance(pr.location, r.location)::int,
         pp.rating_avg
  from service_requests r
  join provider_presence pr
    on pr.is_online
   and pr.updated_at > now() - interval '90 seconds'
   and pr.active_job_id is null
   and r.category_id = any(pr.categories)
   and ST_DWithin(pr.location, r.location, p_radius_m)
  join provider_profiles pp
    on pp.profile_id = pr.provider_id
   and pp.is_published and pp.is_available and pp.verification = 'approved'
  where r.id = p_request
    and not exists (select 1 from request_offers o
                    where o.request_id = r.id and o.provider_id = pr.provider_id)
  order by ST_Distance(pr.location, r.location), pp.rating_avg desc
  limit p_limit;
$$;

create or replace function accept_offer(p_offer uuid, p_eta_s int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_o request_offers; v_r service_requests; v_job uuid;
begin
  select * into v_o from request_offers
   where id = p_offer and provider_id = auth.uid() for update;
  if not found or v_o.status not in ('sent','viewed') or v_o.expires_at < now() then
    raise exception 'offer_unavailable';
  end if;

  select * into v_r from service_requests where id = v_o.request_id for update;
  if v_r.status <> 'open' then raise exception 'request_taken'; end if;

  if exists (select 1 from provider_presence where provider_id = auth.uid() and active_job_id is not null) then
    raise exception 'provider_busy';
  end if;

  update request_offers set status='accepted', responded_at=now(), eta_s = coalesce(p_eta_s, eta_s) where id = p_offer;
  update request_offers set status='cancelled', responded_at=now()
   where request_id = v_o.request_id and id <> p_offer and status in ('sent','viewed');
  update service_requests set status='accepted' where id = v_o.request_id;

  insert into jobs(request_id, client_id, provider_id, status, accepted_at, arrival_eta_s, pickup_location)
  values (v_r.id, v_r.client_id, auth.uid(), 'accepted', now(), coalesce(p_eta_s, v_o.eta_s), v_r.location)
  returning id into v_job;

  update provider_presence set active_job_id = v_job where provider_id = auth.uid();
  return v_job;
end $$;

create or replace function agree_price(p_proposal uuid, p_method payment_method, p_msisdn text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_p job_price_proposals; v_j jobs; v_rate numeric; v_comm numeric; v_id uuid;
begin
  select * into v_p from job_price_proposals where id = p_proposal for update;
  select * into v_j from jobs where id = v_p.job_id for update;
  if v_j.client_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_p.status <> 'pending' then raise exception 'proposal_not_pending'; end if;

  select coalesce(pl.commission_rate, 0.12) into v_rate
    from provider_profiles pp
    left join subscriptions s on s.provider_id = pp.profile_id and s.status = 'active'
    left join plans pl on pl.id = s.plan_id
   where pp.profile_id = v_j.provider_id;

  v_comm := round(v_p.amount * v_rate, 2);
  update job_price_proposals set status='accepted' where id = p_proposal;
  update jobs set price_proposed = v_p.amount where id = v_j.id;

  insert into job_payments(job_id, client_id, provider_id, amount, commission_rate, commission_amount,
                           provider_payout, method, msisdn)
  values (v_j.id, v_j.client_id, v_j.provider_id, v_p.amount, v_rate, v_comm, v_p.amount - v_comm, p_method, p_msisdn)
  returning id into v_id;
  return v_id;
end $$;

create or replace function hold_job_payment(p_job_payment uuid, p_provider_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update job_payments set status='held', held_at=now(), provider_ref = p_provider_ref
   where id = p_job_payment and status = 'pending_payment';
  if not found then return; end if;
  update jobs set status='in_service', started_at = coalesce(started_at, now())
   where id = (select job_id from job_payments where id = p_job_payment);
end $$;

create or replace function release_job_payment(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay job_payments;
begin
  select * into v_pay from job_payments where job_id = p_job for update;
  if not found or v_pay.status <> 'held' then return; end if;

  perform wallet_apply(v_pay.provider_id, 'job_payout', v_pay.provider_payout,
                       'Serviço concluído', null, jsonb_build_object('job_id', p_job));
  insert into platform_revenue(kind, amount, job_id, profile_id)
  values ('commission', v_pay.commission_amount, p_job, v_pay.provider_id);

  update job_payments set status='released', released_at=now() where id = v_pay.id;
  update jobs set status='completed' where id = p_job;
  update provider_presence set active_job_id = null where active_job_id = p_job;
end $$;
