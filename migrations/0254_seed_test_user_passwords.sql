do $$
declare
  v_hash text := '$2b$12$fAxiksYq/wst9cWnvjtn7eV0z7DuwfT0BdB2SASWdPp8/I.OtsDw.';
  v_cliente uuid;
  v_mestre uuid;
  v_categoria int;
  v_distrito int;
begin
  select id into v_categoria from categories where slug = 'mecanico' limit 1;
  select id into v_distrito from districts order by id limit 1;

  insert into profiles(full_name, email, role, district_id, is_active)
  values ('Cliente Teste', 'cliente@teste.com', 'client', v_distrito, true)
  on conflict (email) do update
    set role = 'client', is_active = true, updated_at = now()
  returning id into v_cliente;

  insert into wallets(profile_id) values (v_cliente)
  on conflict (profile_id) do nothing;

  insert into profiles(full_name, email, role, district_id, is_active)
  values ('Mecânico Teste', 'mecanico@teste.com', 'provider', v_distrito, true)
  on conflict (email) do update
    set role = 'provider', is_active = true, updated_at = now()
  returning id into v_mestre;

  insert into wallets(profile_id) values (v_mestre)
  on conflict (profile_id) do nothing;

  insert into user_passwords(profile_id, password_hash)
  values (v_cliente, v_hash), (v_mestre, v_hash)
  on conflict (profile_id) do update
    set password_hash = excluded.password_hash;

  insert into provider_profiles(
    profile_id, slug, business_name, headline, bio, years_experience,
    primary_category_id, district_id, address, lat, lng, service_radius_km,
    verification, verified_at, is_available, is_published
  )
  values (
    v_mestre, 'mecanico-teste', 'Mecânico Teste', 'Mecânico de automóveis em Maputo.',
    'Diagnóstico e reparação de automóveis.', 5,
    v_categoria, v_distrito, 'Maputo', -25.975000, 32.585000, 25,
    'approved', now(), true, true
  )
  on conflict (profile_id) do update
    set business_name = excluded.business_name,
        headline = excluded.headline,
        primary_category_id = excluded.primary_category_id,
        verification = 'approved',
        verified_at = coalesce(provider_profiles.verified_at, now()),
        is_available = true,
        is_published = true,
        updated_at = now();

  if v_categoria is not null then
    insert into provider_categories(provider_id, category_id)
    values (v_mestre, v_categoria)
    on conflict (provider_id, category_id) do nothing;

    insert into provider_services(provider_id, category_id, title, price_min)
    select v_mestre, v_categoria, 'Diagnóstico e reparação de automóveis', 1500
    where not exists (
      select 1 from provider_services where provider_id = v_mestre
    );
  end if;
end $$;
