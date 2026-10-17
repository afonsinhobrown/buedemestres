-- 0206: garantir carteira para todos os perfis.
-- Sem isto, release_job_payment() falha com wallet_not_found quando o mestre
-- ainda não tem carteira criada.
insert into wallets(profile_id)
select id from profiles
on conflict (profile_id) do nothing;

create or replace function create_profile_wallet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into wallets(profile_id) values (new.id) on conflict (profile_id) do nothing;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_profiles_wallet') then
    create trigger trg_profiles_wallet
    after insert on profiles
    for each row execute function create_profile_wallet();
  end if;
end $$;
