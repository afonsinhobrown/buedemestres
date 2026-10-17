-- 0219: quota de serviços para mestres de empresa.
create or replace function company_can_accept(p_provider uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid;
  v_owner uuid;
  v_max int;
  v_used int;
begin
  select cm.company_id, c.owner_id into v_company, v_owner
    from company_masters cm
    join companies c on c.id = cm.company_id
   where cm.provider_id = p_provider and cm.is_active
   limit 1;

  if v_company is null then return false; end if;

  select pl.max_services into v_max
    from subscriptions s
    join plans pl on pl.id = s.plan_id
   where s.provider_id = v_owner and s.status = 'active'
   limit 1;

  if v_max is null then return false; end if;

  select count(*)::int into v_used
    from jobs j
   where j.provider_id in (select provider_id from company_masters where company_id = v_company)
     and j.accepted_at >= date_trunc('month', now())
     and j.status <> 'cancelled';

  return coalesce(v_used, 0) < v_max;
end $$;
