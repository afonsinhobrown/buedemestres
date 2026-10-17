-- 0209: contas de autenticação para os perfis seed (cliente e mestre).
-- Cria os utilizadores no auth.users/auth.identities de forma compatível com GoTrue
-- (colunas de token como string vazia, nunca NULL) para permitir login real.
do $$
declare
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_cliente uuid := '11111111-1111-1111-1111-111111111111';
  v_mestre uuid := '22222222-2222-2222-2222-222222222222';
begin
  insert into auth.users(
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, email_change_confirm_status,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  values
    (v_instance, v_cliente, 'authenticated', 'authenticated', 'cliente@teste.com',
     crypt('password123', gen_salt('bf', 10)), now(), '', '', '', '', '', '', '', '', 0,
     now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('sub', v_cliente::text, 'email', 'cliente@teste.com', 'email_verified', true, 'phone_verified', false, 'full_name', 'Cliente Teste')),
    (v_instance, v_mestre, 'authenticated', 'authenticated', 'mestre@teste.com',
     crypt('password123', gen_salt('bf', 10)), now(), '', '', '', '', '', '', '', '', 0,
     now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('sub', v_mestre::text, 'email', 'mestre@teste.com', 'email_verified', true, 'phone_verified', false, 'full_name', 'Mestre Teste'))
  on conflict (id) do nothing;

  insert into auth.identities(provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (v_cliente::text, v_cliente,
     jsonb_build_object('sub', v_cliente::text, 'email', 'cliente@teste.com', 'email_verified', true, 'phone_verified', false),
     'email', now(), now(), now()),
    (v_mestre::text, v_mestre,
     jsonb_build_object('sub', v_mestre::text, 'email', 'mestre@teste.com', 'email_verified', true, 'phone_verified', false),
     'email', now(), now(), now())
  on conflict (provider_id, provider) do nothing;
end $$;
