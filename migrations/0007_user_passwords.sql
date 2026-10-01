-- Migration 0007: Tabela de palavras-passe (separada dos perfis por segurança)
-- Nunca exposta via SELECT * em profiles

create table user_passwords (
  profile_id    uuid primary key references profiles(id) on delete cascade,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_user_passwords_upd before update on user_passwords
for each row execute function set_updated_at();
