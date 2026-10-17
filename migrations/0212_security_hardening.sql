-- 0212: endurecimento de funções sensíveis.
create or replace function purchase_plan(p_provider uuid, p_plan int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_plan plans;
  v_sub uuid;
  v_discount numeric := provider_referral_discount_pct(p_provider);
  v_price numeric;
begin
  if auth.uid() is not null and p_provider <> auth.uid() then
    raise exception 'forbidden';
  end if;

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

revoke execute on function release_job_payment(uuid) from anon, authenticated;
revoke execute on function complete_payment(uuid) from anon, authenticated;
revoke execute on function wallet_apply(uuid, tx_type, numeric, text, uuid, jsonb) from anon, authenticated;
