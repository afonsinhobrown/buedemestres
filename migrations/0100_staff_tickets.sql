-- Migration para Fase 10 a 14: Superadmin e Tickets

-- 4.1 Enums
create type staff_role       as enum ('support','moderator','finance','admin','superadmin');
create type ticket_status    as enum ('open','in_progress','waiting_customer','resolved','closed');
create type ticket_priority  as enum ('low','normal','high','urgent');
create type ticket_channel   as enum ('app','email','whatsapp','admin');
create type approval_status  as enum ('pending','approved','rejected','expired','executed');

-- 4.2 Staff e permissões
create table permissions (
  code text primary key,
  description text not null
);

create table role_permissions (
  staff_role staff_role not null,
  permission_code text not null references permissions(code) on delete cascade,
  primary key (staff_role, permission_code)
);

create table staff_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  staff_role staff_role not null,
  extra_permissions text[] not null default '{}',
  revoked_permissions text[] not null default '{}',
  must_change_password boolean not null default true,
  mfa_required boolean not null default true,
  is_active boolean not null default true,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_profiles where profile_id = auth.uid() and is_active);
$$;

create or replace function has_permission(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_profiles s
    where s.profile_id = auth.uid() and s.is_active
      and (
        s.staff_role = 'superadmin'
        or (
          (exists (select 1 from role_permissions rp
                   where rp.staff_role = s.staff_role and rp.permission_code = p_code)
           or p_code = any(s.extra_permissions))
          and not (p_code = any(s.revoked_permissions))
        )
      )
  );
$$;

create table staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  staff_role staff_role not null,
  token_hash text not null unique,
  invited_by uuid not null references profiles(id),
  expires_at timestamptz not null default now() + interval '48 hours',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4.3 Configuração, flags, aprovações, visualização como utilizador
create table system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  allowed_users uuid[] not null default '{}',
  description text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  payload jsonb not null,
  reason text not null,
  requested_by uuid not null references profiles(id),
  decided_by uuid references profiles(id),
  status approval_status not null default 'pending',
  decided_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz not null default now() + interval '48 hours',
  created_at timestamptz not null default now(),
  check (decided_by is null or decided_by <> requested_by)
);
create index on approval_requests(status, created_at);

create table impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id),
  target_id uuid not null references profiles(id),
  reason text not null check (char_length(reason) >= 10),
  ticket_id uuid,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  ended_at timestamptz
);

-- Audit Logs adjustments
do $$ begin
  alter table audit_logs add column ip inet;
  alter table audit_logs add column user_agent text;
  alter table audit_logs add column ticket_id uuid;
exception when duplicate_column then null;
end $$;

create index if not exists idx_audit_logs_actor on audit_logs(actor_id, created_at desc);
create index if not exists idx_audit_logs_entity on audit_logs(entity, entity_id);

-- SEEDS (Permissões básicas conforme doc)
insert into permissions (code, description) values
('tickets.read', 'Ler tickets'), ('tickets.reply', 'Responder a tickets'),
('tickets.assign', 'Atribuir tickets'), ('tickets.close', 'Fechar tickets'),
('tickets.internal_notes', 'Notas internas'), ('tickets.macros.manage', 'Gerir macros'),
('users.read', 'Ler utilizadores'), ('users.suspend', 'Suspender utilizadores'),
('users.impersonate', 'Ver como (impersonation)'),
('verifications.review', 'Rever verificações (KYC)'),
('reports.moderate', 'Moderar denúncias'), ('reviews.hide', 'Ocultar avaliações'),
('payments.read', 'Ver pagamentos'), ('payments.confirm', 'Confirmar pagamentos'),
('wallet.adjust.request', 'Pedir ajuste de carteira'), ('wallet.adjust.approve', 'Aprovar ajuste de carteira'),
('commissions.pay', 'Pagar comissões'),
('catalog.manage', 'Gerir catálogo'), ('plans.manage', 'Gerir planos'),
('banners.manage', 'Gerir banners'),
('reports.analytics.read', 'Ver analytics'),
('audit.read', 'Ler logs de auditoria'),
('staff.manage', 'Gerir equipa'), ('permissions.manage', 'Gerir permissões'),
('settings.manage', 'Gerir configurações'), ('flags.manage', 'Gerir feature flags'),
('approvals.decide', 'Decidir aprovações'), ('data.export', 'Exportar dados');

-- Atribuir à role support
insert into role_permissions (staff_role, permission_code) values
('support', 'tickets.read'), ('support', 'tickets.reply'), ('support', 'tickets.assign'),
('support', 'tickets.close'), ('support', 'tickets.internal_notes'), ('support', 'users.read');
