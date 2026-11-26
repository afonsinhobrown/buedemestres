-- 0257: funções do novo fluxo
-- Split na fonte: peças e deslocação não têm comissão; comissão só sobre mão de obra.
-- Mantém as assinaturas antigas de release_job_payment/release_job_addenda.

create extension if not exists pgcrypto;

-- ===== 1. Cálculo da taxa de deslocação =====
create or replace function calculate_travel_fee(
  p_request uuid,
  p_provider uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req service_requests;
  v_provider uuid;
  v_provider_loc geography;
  v_catalog uuid;
  v_rule pricing_rules;
  v_distance_km numeric;
  v_base numeric;
  v_per_km numeric;
  v_included numeric;
  v_road_factor numeric;
  v_min numeric;
  v_max numeric;
  v_raw numeric;
begin
  select * into v_req from service_requests where id = p_request;
  if not found then return 0; end if;

  v_provider := coalesce(p_provider, v_req.target_provider_id);

  if v_provider is not null then
    select location into v_provider_loc
      from provider_presence
     where provider_id = v_provider
       and location is not null
     order by updated_at desc
     limit 1;

    if v_provider_loc is null then
      select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        into v_provider_loc
        from provider_profiles
       where profile_id = v_provider
         and lat is not null
         and lng is not null;
    end if;
  end if;

  select catalog_id into v_catalog
    from jobs
   where request_id = v_req.id
   order by created_at desc
   limit 1;

  select * into v_rule
    from pricing_rules
   where active
     and kind = 'travel'
     and effective_from <= now()
     and (effective_to is null or effective_to >= now())
     and (
       scope = 'global'
       or (scope = 'category' and category_id = v_req.category_id)
       or (scope = 'district' and district_id = v_req.district_id)
       or (scope = 'catalog' and catalog_id = v_catalog)
     )
   order by
     case
       when scope = 'catalog' and catalog_id = v_catalog then 4
       when scope = 'district' and district_id = v_req.district_id then 3
       when scope = 'category' and category_id = v_req.category_id then 2
       when scope = 'global' then 1
       else 0
     end desc,
     priority desc
   limit 1;

  v_base := coalesce(v_rule.base_fee, 100);
  v_per_km := coalesce(v_rule.per_km, 25);
  v_included := coalesce(v_rule.included_km, 2);
  v_road_factor := coalesce(v_rule.road_factor, 1.25);
  v_min := coalesce(v_rule.min_fee, 150);
  v_max := coalesce(v_rule.max_fee, 600);

  if v_req.location is not null and v_provider_loc is not null then
    v_distance_km := round(
      (ST_Distance(v_req.location, v_provider_loc) / 1000 * v_road_factor)::numeric,
      2
    );
    v_raw := v_base + v_per_km * greatest(0, v_distance_km - v_included);
  else
    v_raw := v_base;
  end if;

  v_raw := greatest(v_min, least(v_max, v_raw));
  return round(v_raw / 5) * 5;
end $$;

-- ===== 2. Libertação do pagamento do serviço =====
create or replace function release_job_payment(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay job_payments;
  v_labor numeric;
  v_parts numeric;
  v_commission numeric;
  v_payout numeric;
begin
  select * into v_pay
    from job_payments
   where job_id = p_job and status = 'held'
   for update;

  if not found then return; end if;

  v_labor := coalesce(v_pay.labor_amount, v_pay.amount);
  v_parts := coalesce(v_pay.parts_amount, 0);
  v_commission := round(v_labor * coalesce(v_pay.commission_rate, 0), 2);
  v_payout := round(v_parts + v_labor - v_commission, 2);

  insert into wallets(profile_id) values (v_pay.provider_id)
    on conflict (profile_id) do nothing;

  update job_payments
     set status = 'released',
         released_at = now(),
         commission_amount = v_commission,
         commission_from_wallet = 0,
         provider_payout = v_payout
   where id = v_pay.id;

  perform wallet_apply_earnings(
    v_pay.provider_id,
    'job_payout',
    v_payout,
    'Serviço concluído',
    null,
    jsonb_build_object(
      'job_id', p_job,
      'source', 'service',
      'labor', v_labor,
      'parts', v_parts,
      'commission', v_commission
    )
  );

  if v_commission > 0 then
    insert into platform_revenue(kind, amount, job_id, profile_id)
    values ('commission', v_commission, p_job, v_pay.provider_id);
  end if;

  update jobs
     set status = 'completed',
         completed_at = coalesce(completed_at, now()),
         settled_at = coalesce(settled_at, now()),
         provider_payout_final = coalesce(provider_payout_final, 0) + v_payout
   where id = p_job;

  update provider_presence
     set active_job_id = null
   where active_job_id = p_job;
end $$;

-- ===== 3. Libertação dos aditamentos =====
create or replace function release_job_addenda(p_job uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row job_addenda;
  v_provider uuid;
  v_labor numeric;
  v_parts numeric;
  v_commission numeric;
  v_payout numeric;
  v_total numeric := 0;
begin
  select provider_id into v_provider from jobs where id = p_job;
  if v_provider is null then return 0; end if;

  insert into wallets(profile_id) values (v_provider)
    on conflict (profile_id) do nothing;

  for v_row in
    select * from job_addenda
     where job_id = p_job and status = 'held'
     order by created_at
     for update
  loop
    v_labor := coalesce(v_row.labor_amount, v_row.amount);
    v_parts := coalesce(v_row.parts_amount, 0);
    v_commission := round(v_labor * coalesce(v_row.commission_rate, 0), 2);
    v_payout := round(v_parts + v_labor - v_commission, 2);

    update job_addenda
       set status = 'released',
           released_at = now(),
           commission_amount = v_commission,
           commission_from_wallet = 0,
           provider_payout = v_payout
     where id = v_row.id;

    perform wallet_apply_earnings(
      v_provider,
      'job_payout',
      v_payout,
      'Aditamento de serviço',
      null,
      jsonb_build_object(
        'job_id', p_job,
        'addendum_id', v_row.id,
        'source', 'addendum',
        'labor', v_labor,
        'parts', v_parts,
        'commission', v_commission
      )
    );

    if v_commission > 0 then
      insert into platform_revenue(kind, amount, job_id, profile_id, job_addenda_id)
      values ('commission', v_commission, p_job, v_provider, v_row.id);
    end if;

    v_total := v_total + v_payout;
  end loop;

  if v_total > 0 then
    update jobs
       set provider_payout_final = coalesce(provider_payout_final, 0) + v_total
     where id = p_job;
  end if;

  return v_total;
end $$;

-- ===== 4. Libertação de deslocação e diferença de reclassificação =====
create or replace function release_job_charges(p_job uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row job_charges;
  v_provider uuid;
  v_labor numeric;
  v_parts numeric;
  v_commission numeric;
  v_payout numeric;
  v_total numeric := 0;
begin
  select provider_id into v_provider from jobs where id = p_job;
  if v_provider is null then return 0; end if;

  insert into wallets(profile_id) values (v_provider)
    on conflict (profile_id) do nothing;

  for v_row in
    select * from job_charges
     where job_id = p_job and status = 'held'
     order by created_at
     for update
  loop
    if v_row.kind = 'travel' then
      v_commission := 0;
      v_payout := v_row.amount;
    else
      v_labor := coalesce(v_row.labor_amount, 0);
      v_parts := coalesce(v_row.parts_amount, 0);
      v_commission := least(round(v_labor * coalesce(v_row.commission_rate, 0), 2), v_row.amount);
      v_payout := greatest(v_row.amount - v_commission, 0);
    end if;

    update job_charges
       set status = 'released',
           released_at = now(),
           commission_amount = v_commission,
           provider_payout = v_payout
     where id = v_row.id;

    perform wallet_apply_earnings(
      v_provider,
      'job_payout',
      v_payout,
      case when v_row.kind = 'travel' then 'Taxa de deslocação' else 'Ajuste de serviço' end,
      null,
      jsonb_build_object(
        'job_id', p_job,
        'charge_id', v_row.id,
        'source', v_row.kind,
        'labor', coalesce(v_row.labor_amount, 0),
        'parts', coalesce(v_row.parts_amount, 0),
        'commission', v_commission
      )
    );

    if v_commission > 0 then
      insert into platform_revenue(kind, amount, job_id, profile_id, job_charge_id)
      values ('commission', v_commission, p_job, v_provider, v_row.id);
    end if;

    v_total := v_total + v_payout;
  end loop;

  if v_total > 0 then
    update jobs
       set provider_payout_final = coalesce(provider_payout_final, 0) + v_total
     where id = p_job;
  end if;

  return v_total;
end $$;

-- ===== 5. Fecho único do trabalho =====
create or replace function settle_job(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job jobs;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found then return; end if;

  perform release_job_payment(p_job);
  perform release_job_addenda(p_job);
  perform release_job_charges(p_job);

  update jobs
     set status = 'completed',
         completed_at = coalesce(completed_at, now()),
         settled_at = coalesce(settled_at, now())
   where id = p_job;

  if v_job.request_id is not null then
    update service_requests
       set status = 'completed', updated_at = now()
     where id = v_job.request_id
       and status is distinct from 'completed'
       and status is distinct from 'cancelled';
  end if;

  update provider_presence
     set active_job_id = null
   where active_job_id = p_job;
end $$;

-- ===== 6. PIN de conclusão =====
create or replace function set_job_completion_pin(p_job uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update jobs
     set completion_pin_hash = crypt(p_pin, gen_salt('bf')),
         pin_expires_at = now() + interval '24 hours',
         pin_attempts = 0
   where id = p_job;
end $$;

create or replace function verify_completion_pin(p_job uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job jobs;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found then raise exception 'job_not_found'; end if;
  if v_job.completion_pin_hash is null then raise exception 'pin_not_set'; end if;
  if v_job.pin_expires_at is not null and v_job.pin_expires_at < now() then
    raise exception 'pin_expired';
  end if;
  if coalesce(v_job.pin_attempts, 0) >= 5 then
    raise exception 'pin_blocked';
  end if;

  if crypt(p_pin, v_job.completion_pin_hash) = v_job.completion_pin_hash then
    update jobs set pin_attempts = 0 where id = p_job;
    perform settle_job(p_job);
    return true;
  end if;

  update jobs set pin_attempts = coalesce(pin_attempts, 0) + 1 where id = p_job;
  return false;
end $$;

-- ===== 7. Auto-release após 24h (substitui a versão antiga) =====
create or replace function release_expired_confirmations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j jobs;
  v_count int := 0;
begin
  for v_j in
    select j.*
      from jobs j
      join job_payments p on p.job_id = j.id and p.status = 'held'
     where j.status = 'awaiting_confirmation'
       and j.confirm_deadline is not null
       and j.confirm_deadline < now()
     for update of j skip locked
  loop
    begin
      perform settle_job(v_j.id);

      perform notify_user(
        v_j.provider_id,
        'payment_released',
        'Pagamento libertado automaticamente',
        'O cliente não confirmou em 24 h. O valor foi libertado para a tua carteira.',
        jsonb_build_object('job_id', v_j.id, 'auto', true)
      );
      perform notify_user(
        v_j.client_id,
        'payment_released',
        'Pagamento libertado automaticamente',
        'Passaram 24 h sem confirmação. O pagamento foi libertado ao mestre.',
        jsonb_build_object('job_id', v_j.id, 'auto', true)
      );

      v_count := v_count + 1;
    exception when others then
      raise notice 'release_expired_confirmations falhou para %: %', v_j.id, sqlerrm;
    end;
  end loop;

  return v_count;
end $$;

-- ===== 8. Permissões: dinheiro só via servidor =====
revoke execute on function calculate_travel_fee(uuid, uuid) from public, anon, authenticated;
revoke execute on function release_job_payment(uuid) from public, anon, authenticated;
revoke execute on function release_job_addenda(uuid) from public, anon, authenticated;
revoke execute on function release_job_charges(uuid) from public, anon, authenticated;
revoke execute on function settle_job(uuid) from public, anon, authenticated;
revoke execute on function set_job_completion_pin(uuid, text) from public, anon, authenticated;
revoke execute on function verify_completion_pin(uuid, text) from public, anon, authenticated;
revoke execute on function release_expired_confirmations() from public, anon, authenticated;
