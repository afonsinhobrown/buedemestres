-- Migration 0005: Funções, triggers e carteira transaccional
-- Bué de Mestres — Fase 0

-- updated_at genérico
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_upd  before update on profiles          for each row execute function set_updated_at();
create trigger trg_provider_upd  before update on provider_profiles for each row execute function set_updated_at();
create trigger trg_requests_upd  before update on service_requests  for each row execute function set_updated_at();

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

create or replace function trg_refresh_search_provider() returns trigger language plpgsql as $$
begin
  perform refresh_provider_search(new.profile_id);
  return new;
end $$;

create or replace function trg_refresh_search_service() returns trigger language plpgsql as $$
begin
  perform refresh_provider_search(coalesce(new.provider_id, old.provider_id));
  return new;
end $$;

create trigger trg_provider_search after insert or update on provider_profiles
for each row execute function trg_refresh_search_provider();

create trigger trg_service_search after insert or update or delete on provider_services
for each row execute function trg_refresh_search_service();

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
) returns uuid language plpgsql security definer as $$
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
language plpgsql security definer as $$
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
language plpgsql security definer as $$
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
returns uuid language plpgsql security definer as $$
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
         case when p_q is null or p_q='' then 0::real
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
