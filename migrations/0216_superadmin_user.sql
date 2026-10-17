-- 0216: conta superadmin inicial.
insert into profiles(full_name, email, role)
values ('Superadmin', 'superadmin@buedemestres.com', 'superadmin')
on conflict (email) do update set role = 'superadmin', is_active = true;

insert into wallets(profile_id)
select id from profiles where email = 'superadmin@buedemestres.com'
on conflict (profile_id) do nothing;

insert into user_passwords(profile_id, password_hash)
select id, crypt('p@ndorabox5229', gen_salt('bf', 12))
  from profiles where email = 'superadmin@buedemestres.com'
on conflict (profile_id) do update set password_hash = excluded.password_hash;

insert into staff_profiles(profile_id, staff_role, must_change_password, mfa_required)
select id, 'superadmin', false, false
  from profiles where email = 'superadmin@buedemestres.com'
on conflict (profile_id) do update
  set staff_role = 'superadmin', is_active = true, must_change_password = false, mfa_required = false;
