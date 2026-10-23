-- 0242: contas de teste por especialidade + clientes de teste
-- Password: password123
-- IDs determinísticos a partir do email (md5), para a migração ser idempotente.
--
-- Mestres: canalizador, mecanico, explicador, cabeleleiro, diarista
-- Clientes: cliente1..cliente5
--
-- Os mestres ficam aprovados, publicados e com trial de 30 dias para poderem
-- aceitar pedidos imediatamente. A presença fica offline; a app Pro activa-a
-- (e reclama o dispositivo) quando o mestre entra, via provider_claim_device.

do $$
declare
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_row record;
  v_id uuid;
begin
  for v_row in
    select *
      from (values
        ('canalizador@teste.com', 'Canalizador Teste', 'provider', 10,
         'canalizador-teste', 'Canalizador Teste', 'Canalizador profissional em Maputo.',
         -25.968000::numeric, 32.570000::numeric, 'Reparação de roturas e fugas de água'),
        ('mecanico@teste.com', 'Mecânico Teste', 'provider', 2,
         'mecanico-teste', 'Mecânico Teste', 'Mecânico de automóveis em Maputo.',
         -25.975000::numeric, 32.585000::numeric, 'Diagnóstico e reparação de automóveis'),
        ('explicador@teste.com', 'Explicador Teste', 'provider', 18,
         'explicador-teste', 'Explicador Teste', 'Explicações de Matemática ao domicílio.',
         -25.955000::numeric, 32.590000::numeric, 'Explicações de Matemática'),
        ('cabeleleiro@teste.com', 'Cabeleireiro Teste', 'provider', 36,
         'cabeleleiro-teste', 'Cabeleireiro Teste', 'Cortes e tratamentos de cabelo.',
         -25.960000::numeric, 32.580000::numeric, 'Corte de cabelo ao domicílio'),
        ('diarista@teste.com', 'Diarista Teste', 'provider', 31,
         'diarista-teste', 'Diarista Teste', 'Limpezas domésticas e pós-obra.',
         -25.940000::numeric, 32.595000::numeric, 'Limpeza doméstica'),
        ('cliente1@teste.com', 'Cliente Teste 1', 'client', null, null, null, null, null, null, null),
        ('cliente2@teste.com', 'Cliente Teste 2', 'client', null, null, null, null, null, null, null),
        ('cliente3@teste.com', 'Cliente Teste 3', 'client', null, null, null, null, null, null, null),
        ('cliente4@teste.com', 'Cliente Teste 4', 'client', null, null, null, null, null, null, null),
        ('cliente5@teste.com', 'Cliente Teste 5', 'client', null, null, null, null, null, null, null)
      ) as t(email, full_name, role, category_id, slug, business_name, bio, lat, lng, service_title)
  loop
    v_id := md5(v_row.email)::uuid;

    insert into auth.users(
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current, phone_change, phone_change_token,
      reauthentication_token, email_change_confirm_status,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    )
    values (
      v_instance, v_id, 'authenticated', 'authenticated', v_row.email,
      crypt('password123', gen_salt('bf', 10)), now(), '', '', '', '', '', '', '', '', 0,
      now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'sub', v_id::text,
        'email', v_row.email,
        'email_verified', true,
        'phone_verified', false,
        'full_name', v_row.full_name
      )
    )
    on conflict (id) do nothing;

    insert into auth.identities(provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      v_id::text, v_id,
      jsonb_build_object(
        'sub', v_id::text,
        'email', v_row.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    )
    on conflict (provider_id, provider) do nothing;

    insert into profiles(id, full_name, email, role, district_id, is_active)
    values (v_id, v_row.full_name, v_row.email, v_row.role::user_role, 1, true)
    on conflict (id) do update
      set full_name = excluded.full_name,
          email = excluded.email,
          role = excluded.role,
          is_active = true,
          updated_at = now();

    insert into wallets(profile_id) values (v_id)
      on conflict (profile_id) do nothing;

    if v_row.role = 'provider' then
      insert into provider_profiles(
        profile_id, slug, business_name, headline, bio, years_experience,
        primary_category_id, district_id, address, lat, lng, service_radius_km,
        verification, verified_at, is_available, is_published,
        trial_started_at, trial_ends_at
      )
      values (
        v_id, v_row.slug, v_row.business_name, v_row.business_name, v_row.bio, 5,
        v_row.category_id, 1, 'Maputo', v_row.lat, v_row.lng, 25,
        'approved', now(), true, true,
        now(), now() + interval '30 days'
      )
      on conflict (profile_id) do update
        set slug = excluded.slug,
            business_name = excluded.business_name,
            headline = excluded.headline,
            bio = excluded.bio,
            primary_category_id = excluded.primary_category_id,
            verification = 'approved',
            verified_at = coalesce(provider_profiles.verified_at, now()),
            is_available = true,
            is_published = true,
            trial_started_at = coalesce(provider_profiles.trial_started_at, now()),
            trial_ends_at = greatest(
              coalesce(provider_profiles.trial_ends_at, now()),
              now() + interval '30 days'
            ),
            updated_at = now();

      insert into provider_categories(provider_id, category_id)
      values (v_id, v_row.category_id)
      on conflict (provider_id, category_id) do nothing;

      insert into provider_services(provider_id, category_id, title, price_min)
      select v_id, v_row.category_id, v_row.service_title, 1500
      where not exists (
        select 1 from provider_services where provider_id = v_id
      );

      insert into provider_presence(provider_id, is_online, location, categories, updated_at)
      values (
        v_id, false,
        ST_SetSRID(ST_MakePoint(v_row.lng::float8, v_row.lat::float8), 4326)::geography,
        array[v_row.category_id], now()
      )
      on conflict (provider_id) do update
        set location = excluded.location,
            categories = excluded.categories,
            updated_at = now();

      perform refresh_provider_search(v_id);
    end if;
  end loop;
end $$;
