-- 0247: comissão de 20% descontada do saldo do mestre + planos apenas de prioridade
--
-- Regras:
--   * O mestre tem de ter saldo carregado para operar (saldo mínimo já aplicado
--     por master_can_operate/provider_can_accept).
--   * Em cada serviço, 20% do valor pago pelo cliente são descontados do saldo.
--     O que o saldo não cobrir fica retido no pagamento do cliente. O saldo
--     nunca fica negativo.
--   * O trial dá 0% de comissão nos primeiros trial_services serviços.
--   * Os planos deixam de dar quota/créditos e passam a dar prioridade no
--     despacho e na pesquisa, apenas enquanto o mestre tiver saldo positivo.
--   * Os créditos de serviço são descontinuados.

-- ===== 1. Colunas de controlo da comissão =====
alter table job_payments
  add column if not exists commission_from_wallet numeric(12,2) not null default 0;

alter table job_addenda
  add column if not exists commission_from_wallet numeric(12,2) not null default 0;

-- ===== 2. Libertação do pagamento principal =====
create or replace function release_job_payment(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pay job_payments;
  v_balance numeric;
  v_commission_total numeric;
  v_wallet_take numeric;
  v_withheld numeric;
  v_payout numeric;
begin
  select * into v_pay from job_payments where job_id = p_job for update;
  if not found or v_pay.status <> 'held' then return; end if;

  insert into wallets(profile_id) values (v_pay.provider_id)
    on conflict (profile_id) do nothing;

  v_commission_total := coalesce(v_pay.commission_amount, 0)
                      + coalesce(v_pay.commission_from_wallet, 0);

  select balance into v_balance from wallets where profile_id = v_pay.provider_id for update;
  v_wallet_take := least(greatest(coalesce(v_balance, 0), 0), v_commission_total);
  v_withheld := v_commission_total - v_wallet_take;
  v_payout := v_pay.amount - v_withheld;

  if v_wallet_take > 0 then
    perform wallet_apply(
      v_pay.provider_id,
      'job_commission',
      -v_wallet_take,
      'Comissão da plataforma (20%)',
      null,
      jsonb_build_object('job_id', p_job, 'kind', 'commission')
    );
  end if;

  perform wallet_apply(
    v_pay.provider_id,
    'job_payout',
    v_payout,
    'Serviço concluído',
    null,
    jsonb_build_object('job_id', p_job)
  );

  insert into platform_revenue(kind, amount, job_id, profile_id)
  values ('commission', v_commission_total, p_job, v_pay.provider_id);

  update job_payments
     set status = 'released',
         released_at = now(),
         commission_from_wallet = v_wallet_take,
         commission_amount = v_withheld,
         provider_payout = v_payout
   where id = v_pay.id;

  update jobs set status = 'completed' where id = p_job;
  update provider_presence set active_job_id = null where active_job_id = p_job;
end $$;

-- ===== 3. Libertação dos aditamentos (mesma regra) =====
create or replace function release_job_addenda(p_job uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_provider uuid;
  v_row job_addenda;
  v_balance numeric;
  v_commission_total numeric;
  v_wallet_take numeric;
  v_withheld numeric;
  v_payout numeric;
  v_total numeric := 0;
begin
  select provider_id into v_provider from job_payments where job_id = p_job limit 1;
  if v_provider is null then return 0; end if;

  insert into wallets(profile_id) values (v_provider)
    on conflict (profile_id) do nothing;

  for v_row in
    select * from job_addenda
     where job_id = p_job and status = 'held'
     order by created_at
     for update
  loop
    v_commission_total := coalesce(v_row.commission_amount, 0)
                        + coalesce(v_row.commission_from_wallet, 0);

    select balance into v_balance from wallets where profile_id = v_provider for update;
    v_wallet_take := least(greatest(coalesce(v_balance, 0), 0), v_commission_total);
    v_withheld := v_commission_total - v_wallet_take;
    v_payout := v_row.amount - v_withheld;

    if v_wallet_take > 0 then
      perform wallet_apply(
        v_provider,
        'job_commission',
        -v_wallet_take,
        'Comissão da plataforma (20%) — aditamento',
        null,
        jsonb_build_object('job_id', p_job, 'addendum_id', v_row.id, 'kind', 'commission')
      );
    end if;

    perform wallet_apply(
      v_provider,
      'job_payout',
      v_payout,
      'Aditamento de serviço',
      null,
      jsonb_build_object('job_id', p_job, 'addendum_id', v_row.id, 'kind', 'addendum')
    );

    insert into platform_revenue(kind, amount, job_id, profile_id)
    values ('commission', v_commission_total, p_job, v_provider);

    update job_addenda
       set status = 'released',
           released_at = now(),
           commission_from_wallet = v_wallet_take,
           commission_amount = v_withheld,
           provider_payout = v_payout
     where id = v_row.id;

    v_total := v_total + v_payout;
  end loop;

  return v_total;
end $$;

-- ===== 4. Libertação automática após 24h usa a nova regra =====
create or replace function release_expired_confirmations()
returns int language plpgsql security definer set search_path = public as $$
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
      insert into wallets(profile_id) values (v_j.provider_id)
        on conflict (profile_id) do nothing;

      perform release_job_payment(v_j.id);
      perform release_job_addenda(v_j.id);

      if v_j.request_id is not null then
        update service_requests
           set status = 'completed', updated_at = now()
         where id = v_j.request_id
           and status is distinct from 'completed';
      end if;

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

-- ===== 5. Prioridade dos planos =====
-- Devolve 0 se não houver plano ativo ou se o mestre não tiver saldo positivo.
-- Caso contrário soma:
--   1000  prioridade na janela configurada (priority_hours / weekend_priority)
--    250  prioridade para clientes recorrentes (recurring_visibility)
--    rating_boost * 100 (bónus de ranking)
create or replace function provider_priority_score(p_provider uuid, p_client uuid default null)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_plan plans;
  v_local timestamp;
  v_dow int;
  v_time time;
  v_mode text;
  v_start time;
  v_end time;
  v_score numeric := 0;
begin
  if coalesce(master_wallet_balance(p_provider), 0) <= 0 then
    return 0;
  end if;

  select pl.* into v_plan
    from subscriptions s
    join plans pl on pl.id = s.plan_id
   where s.provider_id = p_provider
     and s.status = 'active'
     and s.ends_at > now()
   order by s.ends_at desc
   limit 1;

  if not found then return 0; end if;

  v_local := timezone('Africa/Maputo', now());
  v_dow := extract(isodow from v_local)::int;
  v_time := v_local::time;
  v_mode := coalesce(v_plan.priority_hours->>'mode', 'none');
  v_start := coalesce((v_plan.priority_hours->>'start')::time, '00:00'::time);
  v_end := coalesce((v_plan.priority_hours->>'end')::time, '23:59'::time);

  if v_mode = 'always' then
    v_score := 1000;
  elsif v_mode = 'weekend' and v_dow >= 6 and v_time between v_start and v_end then
    v_score := 1000;
  elsif v_mode = 'weekdays' and v_dow <= 5 and v_time between v_start and v_end then
    v_score := 1000;
  end if;

  if coalesce(v_plan.weekend_priority, false) and v_dow >= 6 then
    v_score := greatest(v_score, 1000);
  end if;

  if p_client is not null and coalesce(v_plan.recurring_visibility, false) then
    if exists (
      select 1 from jobs j
       where j.provider_id = p_provider
         and j.client_id = p_client
         and j.status = 'completed'
    ) then
      v_score := v_score + 250;
    end if;
  end if;

  v_score := v_score + coalesce(v_plan.rating_boost, 0) * 100;
  return v_score;
end $$;

grant execute on function provider_priority_score(uuid, uuid) to anon, authenticated;

-- ===== 6. Despacho: só mestres com saldo e ordenados por prioridade =====
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
    and master_can_operate(pr.provider_id)
    and master_wallet_balance(pr.provider_id) > 0
    and not exists (select 1 from request_offers o
                    where o.request_id = r.id and o.provider_id = pr.provider_id)
  order by provider_priority_score(pr.provider_id, r.client_id) desc,
           ST_Distance(pr.location, r.location),
           pp.rating_avg desc
  limit p_limit;
$$;

-- ===== 7. Pesquisa pública: prioridade do plano antes dos destaques =====
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
  order by provider_priority_score(pp.profile_id, null) desc,
           is_featured desc, is_priority desc, rank desc, pp.rating_avg desc, pp.jobs_completed desc
  limit p_limit offset p_offset;
$$;

-- ===== 8. Configuração de planos e taxas =====
update plans set commission_rate = 0.20;
update plans set featured_days_included = 0;

update plans
   set priority_hours = '{"mode":"none"}'::jsonb,
       weekend_priority = false,
       recurring_visibility = false,
       rating_boost = 0
 where code = 'basic';

update plans
   set priority_hours = '{"mode":"weekend","start":"08:00","end":"20:00"}'::jsonb,
       weekend_priority = true,
       recurring_visibility = true,
       rating_boost = 0.20
 where code = 'standard';

update plans
   set priority_hours = '{"mode":"always","start":"00:00","end":"23:59"}'::jsonb,
       weekend_priority = true,
       recurring_visibility = true,
       rating_boost = 0.50
 where code = 'premium';

update plans
   set priority_hours = '{"mode":"none"}'::jsonb,
       weekend_priority = false,
       recurring_visibility = true,
       rating_boost = 0.10
 where code = 'company_basic';

update plans
   set priority_hours = '{"mode":"weekend","start":"08:00","end":"20:00"}'::jsonb,
       weekend_priority = true,
       recurring_visibility = true,
       rating_boost = 0.30
 where code = 'company_standard';

update plans
   set priority_hours = '{"mode":"always","start":"00:00","end":"23:59"}'::jsonb,
       weekend_priority = true,
       recurring_visibility = true,
       rating_boost = 0.50
 where code = 'company_premium';

insert into app_settings(key, value) values
  ('commission_rate', '0.20'::jsonb),
  ('trial_commission_rate', '0'::jsonb),
  ('trial_services', '5'::jsonb)
on conflict (key) do update set value = excluded.value;

-- ===== 9. Descontinuar créditos de serviço =====
drop function if exists purchase_credits(uuid, int);
drop function if exists consume_service_credit(uuid);
