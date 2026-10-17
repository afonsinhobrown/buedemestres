-- 0211: sandbox, planos (basic/standard/premium) e desconto por indicações.
insert into app_settings(key, value) values
  ('sandbox_mode', 'true'::jsonb),
  ('sandbox_min_price', '1'::jsonb),
  ('sandbox_max_price', '10'::jsonb),
  ('referral_threshold', '10'::jsonb),
  ('referral_discount_pct', '20'::jsonb)
on conflict (key) do nothing;

alter table plans
  add column if not exists weekend_priority boolean not null default false,
  add column if not exists priority_hours jsonb not null default '{}'::jsonb,
  add column if not exists recurring_visibility boolean not null default false,
  add column if not exists rating_boost numeric(4,2) not null default 0,
  add column if not exists referral_discount_eligible boolean not null default false;

update plans set code = 'basic', name = 'Básico'
 where code = 'free' and not exists (select 1 from plans where code = 'basic');
update plans set code = 'standard', name = 'Standard'
 where code = 'pro' and not exists (select 1 from plans where code = 'standard');

update plans
   set max_services = 3, max_photos = 3, max_categories = 1, monthly_quotes = 5,
       weekend_priority = false, recurring_visibility = false,
       priority_hours = '{"mode":"weekdays","start":"08:00","end":"18:00"}'::jsonb,
       rating_boost = 0
 where code = 'basic';

update plans
   set max_services = 10, max_photos = 10, max_categories = 3, monthly_quotes = 30,
       weekend_priority = true, recurring_visibility = true,
       priority_hours = '{"mode":"weekend","start":"08:00","end":"20:00"}'::jsonb,
       rating_boost = 0.20
 where code = 'standard';

update plans
   set max_services = 30, max_photos = 30, max_categories = 5, monthly_quotes = null,
       weekend_priority = true, recurring_visibility = true,
       priority_hours = '{"mode":"always","start":"00:00","end":"23:59"}'::jsonb,
       rating_boost = 0.50
 where code = 'premium';

create or replace function provider_referral_count(p_provider uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from referrals r
    join profiles p on p.id = r.referred_id
   where r.referrer_id = p_provider
     and p.role = 'provider'
$$;

create or replace function provider_referral_discount_pct(p_provider uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case
           when provider_referral_count(p_provider) >= coalesce((select (value)::text::int from app_settings where key = 'referral_threshold'), 10)
           then coalesce((select (value)::text::numeric from app_settings where key = 'referral_discount_pct'), 20)
           else 0
         end
$$;

create or replace function purchase_plan(p_provider uuid, p_plan int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_plan plans;
  v_sub uuid;
  v_discount numeric := provider_referral_discount_pct(p_provider);
  v_price numeric;
begin
  select * into v_plan from plans where id = p_plan and is_active;
  if not found then raise exception 'plan_not_found'; end if;

  v_price := round(v_plan.price * (1 - v_discount / 100), 2);
  perform wallet_apply(p_provider, 'plan_purchase', -v_price,
                       'Plano ' || v_plan.name ||
                       case when v_discount > 0 then ' (desconto de ' || v_discount || '% por indicações)' else '' end);
  update subscriptions set status = 'cancelled' where provider_id = p_provider and status = 'active';
  insert into subscriptions(provider_id, plan_id, ends_at)
  values (p_provider, p_plan, now() + make_interval(days => v_plan.duration_days))
  returning id into v_sub;

  if v_plan.featured_days_included > 0 then
    insert into boosts(provider_id, type, ends_at, price_paid)
    values (p_provider, 'featured', now() + make_interval(days => v_plan.featured_days_included), 0);
  end if;
  return v_sub;
end $$;
