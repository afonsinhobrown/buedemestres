alter table provider_profiles
  add column if not exists temporary_access_until timestamptz,
  add column if not exists temporary_access_granted_by uuid references profiles(id),
  add column if not exists temporary_access_reason text;

create or replace function expire_temporary_provider_access()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update provider_profiles
     set verification = 'none',
         is_published = false,
         is_available = false,
         temporary_access_until = null,
         updated_at = now()
   where temporary_access_until is not null
     and temporary_access_until < now()
     and verification = 'approved';

  get diagnostics v_count = row_count;
  return v_count;
end $$;
