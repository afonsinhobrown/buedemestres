do $$
declare
  v_ids uuid[];
begin
  select array_agg(id)
    into v_ids
    from profiles
   where lower(email) like '%@teste.com';

  if v_ids is null or cardinality(v_ids) = 0 then
    return;
  end if;

  delete from user_passwords where profile_id = any(v_ids);

  begin
    delete from auth.identities
     where user_id in (
       select id from auth.users where lower(email) like '%@teste.com'
     );
  exception when undefined_table or undefined_column then
    null;
  end;

  begin
    delete from auth.users where lower(email) like '%@teste.com';
  exception when undefined_table or undefined_column then
    null;
  end;

  update provider_profiles
     set verification = 'none',
         is_published = false,
         is_available = false,
         updated_at = now()
   where profile_id = any(v_ids);

  update profiles
     set is_active = false,
         email = 'removed+' || id::text || '@invalid.local',
         full_name = 'Conta de teste removida',
         updated_at = now()
   where id = any(v_ids);

  delete from profiles p
   where p.id = any(v_ids)
     and not exists (select 1 from jobs j where j.client_id = p.id or j.provider_id = p.id)
     and not exists (
       select 1 from service_requests r
        where r.client_id = p.id or r.target_provider_id = p.id
     );
end $$;
