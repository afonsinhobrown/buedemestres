# BUÉ DE MESTRES — Plano de Implementação: Tickets e Superadmin

> Complementa `BUEDEMESTRES_PLANO_IMPLEMENTACAO.md` (negócio + esquema) e `BUEDEMESTRES_FRONTEND_DESIGN.md` (design).
> Fases novas: **10 a 14**. Idioma da interface: português de Moçambique.

---

## 0. INSTRUÇÕES PARA O AGENTE

1. Ler o plano principal (secções 4.5, 4.7 e 5) antes de começar. Este módulo **estende** o esquema existente; não o reescreve.
2. **REGRA DE CREDENCIAIS (obrigatória):** a palavra-passe inicial do superadmin é fornecida pelo proprietário **apenas** através da variável de ambiente local `SUPERADMIN_INITIAL_PASSWORD`. É proibido escrevê-la em código, migrations, seeds, testes, documentação, logs, mensagens de commit ou ficheiros versionados. Testes automáticos usam palavras-passe geradas aleatoriamente.
3. O superadmin **nunca** se regista pela interface pública. Só é criado pelo script de arranque (secção 3.1).
4. Toda a acção de staff com efeito (alterar dados, dinheiro, permissões, contas) escreve em `audit_logs`.
5. Toda a verificação de permissão acontece **no servidor e na base de dados (RLS/funções)**; esconder um botão na interface nunca conta como controlo de acesso.
6. Seguir o design do documento de frontend. A área de staff usa os mesmos tokens, com interface densa; a área de superadmin tem **barra superior em vermelho óxido** para sinalizar modo elevado.

---

## 1. ÂMBITO

**Tickets:** canal oficial de suporte entre utilizadores (clientes e mestres) e a equipa. Cobre disputas de trabalhos, problemas de pagamento/carteira, verificação de identidade, denúncias, erros técnicos e sugestões.

**Superadmin:** nível máximo de controlo da plataforma: gestão da equipa e permissões, configurações do sistema, aprovações financeiras, auditoria, visualização "como o utilizador" (só leitura) e operações de emergência.

---

## 2. PAPÉIS DE STAFF E PERMISSÕES

Papéis (independentes de `profiles.role`; um utilizador de staff também tem conta normal):

| Papel | Foco |
|---|---|
| `support` | Tickets, mensagens, utilizadores (leitura) |
| `moderator` | Denúncias, avaliações, verificações, suspensão de perfis |
| `finance` | Pagamentos, carteiras, comissões de afiliados, relatórios de receita |
| `admin` | Tudo o que é operacional (catálogo, planos, banners, utilizadores). **Não** gere staff nem configurações de sistema |
| `superadmin` | Tudo, incluindo staff, permissões, configurações, aprovações, flags, auditoria completa, visualização como utilizador |

### Catálogo de permissões (códigos)

```
tickets.read  tickets.reply  tickets.assign  tickets.close  tickets.internal_notes  tickets.macros.manage
users.read    users.suspend  users.impersonate
verifications.review
reports.moderate  reviews.hide
payments.read  payments.confirm  wallet.adjust.request  wallet.adjust.approve
commissions.pay
catalog.manage  plans.manage  banners.manage
reports.analytics.read
audit.read
staff.manage  permissions.manage  settings.manage  flags.manage  approvals.decide  data.export
```

### Matriz por papel

| Permissão | support | moderator | finance | admin | superadmin |
|---|:-:|:-:|:-:|:-:|:-:|
| tickets.read/reply/internal_notes | ✔ | ✔ | ✔ | ✔ | ✔ |
| tickets.assign/close | ✔ | ✔ | — | ✔ | ✔ |
| tickets.macros.manage | — | — | — | ✔ | ✔ |
| users.read | ✔ | ✔ | ✔ | ✔ | ✔ |
| users.suspend | — | ✔ | — | ✔ | ✔ |
| verifications.review, reports.moderate, reviews.hide | — | ✔ | — | ✔ | ✔ |
| payments.read/confirm | — | — | ✔ | ✔ | ✔ |
| wallet.adjust.request | — | — | ✔ | ✔ | ✔ |
| wallet.adjust.approve, commissions.pay | — | — | ✔ (comissões) | — | ✔ |
| catalog/plans/banners.manage | — | — | — | ✔ | ✔ |
| reports.analytics.read | — | — | ✔ | ✔ | ✔ |
| audit.read | — | — | — | ✔ (parcial) | ✔ (total) |
| staff/permissions/settings/flags.manage, approvals.decide, data.export, users.impersonate | — | — | — | — | ✔ |

Permissões extra ou revogadas por pessoa via `extra_permissions` / `revoked_permissions` (só o superadmin altera).

---

## 3. SUPERADMIN

### 3.1 Criação segura (arranque)

Script `scripts/bootstrap-superadmin.ts`, idempotente, executado manualmente pelo proprietário (`npm run bootstrap:superadmin`), **nunca** em CI nem em runtime da aplicação.

Variáveis de ambiente (só locais/servidor, fora do repositório; `.env*` no `.gitignore`):

```
SUPERADMIN_EMAIL=
SUPERADMIN_FULL_NAME=
SUPERADMIN_INITIAL_PASSWORD=     # fornecida pelo proprietário; mínimo 12 caracteres
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
```

Lógica:

```ts
// scripts/bootstrap-superadmin.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_INITIAL_PASSWORD;
const fullName = process.env.SUPERADMIN_FULL_NAME ?? 'Superadmin';

if (!email || !password) throw new Error('Defina SUPERADMIN_EMAIL e SUPERADMIN_INITIAL_PASSWORD');
if (password.length < 12) throw new Error('A palavra-passe inicial deve ter pelo menos 12 caracteres');

const admin = createClient(url, key, { auth: { persistSession: false } });

// 1) obter ou criar o utilizador (nunca imprimir a palavra-passe)
let userId: string | undefined;
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
userId = list?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id;

if (!userId) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  userId = data.user.id;
}

// 2) registar como superadmin (o trigger handle_new_user já cria profiles + wallets)
await admin.from('staff_profiles').upsert({
  profile_id: userId, staff_role: 'superadmin',
  must_change_password: true, mfa_required: true, is_active: true,
}, { onConflict: 'profile_id' });

await admin.from('audit_logs').insert({
  actor_id: userId, action: 'superadmin.bootstrap', entity: 'staff_profiles', entity_id: userId,
});
console.log('Superadmin pronto. No primeiro acesso será obrigatório mudar a palavra-passe e activar MFA.');
```

Regras do script:
- Não imprime nem regista a palavra-passe.
- Se o superadmin já existir, **não altera a palavra-passe** (só garante o papel).
- Recusa executar em `NODE_ENV=production` sem `--i-know-what-im-doing`.

### 3.2 Primeiro acesso e política de credenciais

- `must_change_password = true` ⇒ o middleware bloqueia tudo excepto `/superadmin/definir-senha` até a palavra-passe ser alterada. A nova palavra-passe: ≥ 12 caracteres, diferente da inicial, verificada contra lista de palavras-passe comuns.
- **MFA obrigatório (TOTP)** para todo o staff, e sempre para o superadmin: sem `aal2` na sessão, redirecciona para `/superadmin/mfa`. Gerar 10 códigos de recuperação de uso único no enrolamento.
- Sessões de staff: expiram em 8 h (superadmin 4 h); inactividade 30 min.
- **Step-up (reautenticação)** exigido antes de: alterar permissões, criar/desactivar staff, aprovar ajustes financeiros, exportar dados, iniciar visualização como utilizador, mudar configurações críticas. Pede palavra-passe + código TOTP; válido 5 minutos.
- **Bloqueio:** 5 falhas seguidas ⇒ bloqueio de 15 min e e-mail ao titular. Novo dispositivo/IP ⇒ e-mail de alerta.
- Opcional (configuração): lista de IPs permitidos para `/superadmin`.
- Rotação: lembrete de mudança de palavra-passe a cada 90 dias.

### 3.3 Funcionalidades do superadmin

1. **Equipa e permissões:** convidar staff por e-mail (convite com expiração de 48 h), atribuir papel, conceder/revogar permissões extra, desactivar/reactivar, terminar sessões activas.
2. **Aprovações (dupla aprovação):** ajustes de carteira acima do limite (`settings.wallet_adjust_limit_mzn`, valor inicial 1 000 MT), reembolsos e pagamentos de comissões em lote exigem pedido por uma pessoa e aprovação por **outra**. Ninguém aprova o próprio pedido (regra imposta na base de dados).
3. **Configurações do sistema:** comissão de afiliado, validade de comprovativos, limites de plano, mínimo de carregamento, SLA por categoria, textos legais, modo de manutenção.
4. **Feature flags:** activar/desactivar módulos (pagamentos automáticos, chat, afiliados, destaques) globalmente ou por percentagem/utilizadores.
5. **Visualização como utilizador (só leitura):** ver a aplicação como um cliente/mestre para reproduzir problemas. Exige motivo (e opcionalmente nº de ticket), dura 15 min, mostra faixa permanente "A ver como [nome] — só leitura", **bloqueia toda a escrita** e regista início/fim em `audit_logs`. Nunca permite ver palavras-passe, códigos MFA ou documentos de identidade fora do fluxo de verificação.
6. **Auditoria total:** pesquisa e filtros por actor, entidade, acção, intervalo; exportação (requer `data.export` + step-up).
7. **Operações de emergência:** suspender utilizador, congelar carteira, desactivar plano/destaque, modo de manutenção, revogar todas as sessões de um utilizador.
8. **Saúde do sistema:** painel simples com webhooks falhados, pagamentos pendentes há > 48 h, tickets com SLA em risco, filas de verificação.

---

## 4. ESQUEMA DE BASE DE DADOS (migration `0100_staff_tickets.sql`)

### 4.1 Enums

```sql
create type staff_role       as enum ('support','moderator','finance','admin','superadmin');
create type ticket_status    as enum ('open','in_progress','waiting_customer','resolved','closed');
create type ticket_priority  as enum ('low','normal','high','urgent');
create type ticket_channel   as enum ('app','email','whatsapp','admin');
create type approval_status  as enum ('pending','approved','rejected','expired','executed');
```

### 4.2 Staff e permissões

```sql
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
```

### 4.3 Configuração, flags, aprovações, visualização como utilizador

```sql
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
  action_type text not null,            -- 'wallet_adjust' | 'refund' | 'commission_batch'
  payload jsonb not null,               -- ex.: {"profile_id":"...","amount":-500,"reason":"..."}
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

alter table audit_logs add column if not exists ip inet;
alter table audit_logs add column if not exists user_agent text;
alter table audit_logs add column if not exists ticket_id uuid;
create index on audit_logs(actor_id, created_at desc);
create index on audit_logs(entity, entity_id);
```

### 4.4 Tickets

```sql
create sequence ticket_number_seq start 1000;

create table ticket_categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  default_priority ticket_priority not null default 'normal',
  first_response_minutes int not null default 480,    -- 8 h
  resolution_minutes int not null default 4320,       -- 3 dias
  required_permission text,                            -- ex.: 'payments.read' para restringir
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('ticket_number_seq'),  -- mostrado como TKT-1000
  requester_id uuid not null references profiles(id),
  category_id int not null references ticket_categories(id),
  subject text not null check (char_length(subject) between 5 and 120),
  description text not null check (char_length(description) between 10 and 5000),
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'normal',
  channel ticket_channel not null default 'app',
  assigned_to uuid references profiles(id),
  related_job_id uuid references jobs(id),
  related_payment_id uuid references payments(id),
  related_provider_id uuid references provider_profiles(profile_id),
  related_request_id uuid references service_requests(id),
  related_report_id uuid references reports(id),
  tags text[] not null default '{}',
  first_response_due timestamptz,
  resolution_due timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_breached boolean not null default false,
  csat_rating smallint check (csat_rating between 1 and 5),
  csat_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tickets(status, priority, created_at desc);
create index on tickets(assigned_to, status);
create index on tickets(requester_id, created_at desc);
create index on tickets(sla_breached) where sla_breached;

create table ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null check (char_length(body) between 1 and 5000),
  is_internal boolean not null default false,   -- nota interna: invisível ao utilizador
  created_at timestamptz not null default now()
);
create index on ticket_messages(ticket_id, created_at);

create table ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  message_id uuid references ticket_messages(id) on delete cascade,
  storage_path text not null,     -- bucket privado 'ticket-attachments'
  file_name text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes <= 5242880),
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table ticket_events (         -- linha do tempo e auditoria do ticket
  id bigserial primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  actor_id uuid references profiles(id),
  type text not null,               -- created | assigned | status_changed | priority_changed | reopened | csat | sla_breached
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on ticket_events(ticket_id, created_at);

create table ticket_macros (         -- respostas rápidas
  id serial primary key,
  title text not null,
  body text not null,
  category_id int references ticket_categories(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id)
);

create trigger trg_tickets_upd before update on tickets
for each row execute function set_updated_at();
```

### 4.5 Funções (toda a lógica de estado no servidor)

```sql
-- Criar ticket (utilizador autenticado) com SLA da categoria
create or replace function create_ticket(
  p_category int, p_subject text, p_description text,
  p_job uuid default null, p_payment uuid default null,
  p_provider uuid default null, p_request uuid default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_cat ticket_categories; v_id uuid; v_number bigint;
begin
  select * into v_cat from ticket_categories where id = p_category and is_active;
  if not found then raise exception 'category_not_found'; end if;

  -- limite anti-abuso: máx. 5 tickets abertos por utilizador
  if (select count(*) from tickets where requester_id = auth.uid()
      and status in ('open','in_progress','waiting_customer')) >= 5 then
    raise exception 'too_many_open_tickets';
  end if;

  insert into tickets(requester_id, category_id, subject, description, priority,
     related_job_id, related_payment_id, related_provider_id, related_request_id,
     first_response_due, resolution_due)
  values (auth.uid(), p_category, p_subject, p_description, v_cat.default_priority,
     p_job, p_payment, p_provider, p_request,
     now() + make_interval(mins => v_cat.first_response_minutes),
     now() + make_interval(mins => v_cat.resolution_minutes))
  returning id, number into v_id, v_number;

  insert into ticket_events(ticket_id, actor_id, type) values (v_id, auth.uid(), 'created');
  return v_number;
end $$;

-- Responder / nota interna
create or replace function add_ticket_message(p_ticket uuid, p_body text, p_internal boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_t tickets; v_staff boolean := is_staff(); v_msg uuid;
begin
  select * into v_t from tickets where id = p_ticket for update;
  if not found then raise exception 'ticket_not_found'; end if;

  if v_staff then
    if not has_permission(case when p_internal then 'tickets.internal_notes' else 'tickets.reply' end) then
      raise exception 'forbidden';
    end if;
  else
    if v_t.requester_id <> auth.uid() then raise exception 'forbidden'; end if;
    if p_internal then raise exception 'forbidden'; end if;
    if v_t.status = 'closed' then raise exception 'ticket_closed'; end if;
  end if;

  insert into ticket_messages(ticket_id, author_id, body, is_internal)
  values (p_ticket, auth.uid(), p_body, p_internal) returning id into v_msg;

  if v_staff and not p_internal then
    update tickets set
      status = case when status in ('open','in_progress') then 'waiting_customer' else status end,
      first_response_at = coalesce(first_response_at, now()),
      assigned_to = coalesce(assigned_to, auth.uid())
    where id = p_ticket;
  elsif not v_staff then
    update tickets set
      status = case when status in ('waiting_customer','resolved') then 'open' else status end,
      resolved_at = null
    where id = p_ticket;
    if v_t.status = 'resolved' then
      insert into ticket_events(ticket_id, actor_id, type) values (p_ticket, auth.uid(), 'reopened');
    end if;
  end if;
  return v_msg;
end $$;

-- Mudar estado / prioridade / atribuição (staff)
create or replace function update_ticket(
  p_ticket uuid, p_status ticket_status default null,
  p_priority ticket_priority default null, p_assignee uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_t tickets;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into v_t from tickets where id = p_ticket for update;
  if not found then raise exception 'ticket_not_found'; end if;

  if p_assignee is not null and not has_permission('tickets.assign') then raise exception 'forbidden'; end if;
  if p_status in ('resolved','closed') and not has_permission('tickets.close') then raise exception 'forbidden'; end if;

  update tickets set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    assigned_to = coalesce(p_assignee, assigned_to),
    resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
    closed_at   = case when p_status = 'closed' then now() else closed_at end
  where id = p_ticket;

  if p_status is not null and p_status <> v_t.status then
    insert into ticket_events(ticket_id, actor_id, type, meta)
    values (p_ticket, auth.uid(), 'status_changed', jsonb_build_object('from', v_t.status, 'to', p_status));
  end if;
  if p_assignee is not null and p_assignee is distinct from v_t.assigned_to then
    insert into ticket_events(ticket_id, actor_id, type, meta)
    values (p_ticket, auth.uid(), 'assigned', jsonb_build_object('to', p_assignee));
  end if;
end $$;

-- Avaliação de satisfação (só o autor, só após resolvido/fechado)
create or replace function rate_ticket(p_ticket uuid, p_rating smallint, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update tickets set csat_rating = p_rating, csat_comment = p_comment
  where id = p_ticket and requester_id = auth.uid()
    and status in ('resolved','closed') and csat_rating is null;
  if not found then raise exception 'rating_not_allowed'; end if;
  insert into ticket_events(ticket_id, actor_id, type, meta)
  values (p_ticket, auth.uid(), 'csat', jsonb_build_object('rating', p_rating));
end $$;
```

### 4.6 Aprovações financeiras

```sql
-- Pedir ajuste de carteira (staff com wallet.adjust.request)
create or replace function request_wallet_adjustment(p_profile uuid, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not has_permission('wallet.adjust.request') then raise exception 'forbidden'; end if;
  insert into approval_requests(action_type, payload, reason, requested_by)
  values ('wallet_adjust', jsonb_build_object('profile_id', p_profile, 'amount', p_amount), p_reason, auth.uid())
  returning id into v_id;
  insert into audit_logs(actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'approval.requested', 'approval_requests', v_id::text, jsonb_build_object('amount', p_amount));
  return v_id;
end $$;

-- Decidir (outra pessoa com wallet.adjust.approve); executa se aprovado
create or replace function decide_approval(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_a approval_requests;
begin
  if not has_permission('approvals.decide') and not has_permission('wallet.adjust.approve') then
    raise exception 'forbidden';
  end if;
  select * into v_a from approval_requests where id = p_id for update;
  if v_a.status <> 'pending' or v_a.expires_at < now() then raise exception 'approval_not_pending'; end if;
  if v_a.requested_by = auth.uid() then raise exception 'cannot_approve_own_request'; end if;

  update approval_requests set
    status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = auth.uid(), decided_at = now()
  where id = p_id;

  if p_approve and v_a.action_type = 'wallet_adjust' then
    perform wallet_apply((v_a.payload->>'profile_id')::uuid, 'adjustment',
                         (v_a.payload->>'amount')::numeric, 'Ajuste aprovado: '||v_a.reason);
    update approval_requests set status = 'executed', executed_at = now() where id = p_id;
  end if;

  insert into audit_logs(actor_id, action, entity, entity_id, meta)
  values (auth.uid(), case when p_approve then 'approval.approved' else 'approval.rejected' end,
          'approval_requests', p_id::text, v_a.payload);
end $$;
```

Ajustes de valor absoluto **abaixo** do limite podem ser executados directamente por `finance` via função equivalente que lê `system_settings.wallet_adjust_limit_mzn`; acima do limite, obrigatoriamente por aprovação.

### 4.7 Jobs agendados (`pg_cron`)

```sql
-- marcar SLA falhado (de 5 em 5 minutos)
select cron.schedule('tickets-sla','*/5 * * * *', $$
  update tickets set sla_breached = true
  where not sla_breached and status in ('open','in_progress','waiting_customer')
    and ((first_response_at is null and first_response_due < now()) or resolution_due < now());
  insert into ticket_events(ticket_id, type)
    select id, 'sla_breached' from tickets t where sla_breached
    and not exists (select 1 from ticket_events e where e.ticket_id=t.id and e.type='sla_breached');
$$);

-- fechar tickets resolvidos sem resposta há 5 dias (diário)
select cron.schedule('tickets-autoclose','0 2 * * *', $$
  update tickets set status='closed', closed_at=now()
  where status='resolved' and resolved_at < now() - interval '5 days'
$$);

-- expirar aprovações pendentes
select cron.schedule('approvals-expire','*/30 * * * *', $$
  update approval_requests set status='expired' where status='pending' and expires_at < now()
$$);

-- escalar: waiting_customer sem resposta há 7 dias -> resolvido (aviso ao utilizador antes)
```

---

## 5. TICKETS: REGRAS DE NEGÓCIO

**Categorias iniciais (seed):**

| slug | Nome | Prioridade | 1.ª resposta | Resolução | Restrição |
|---|---|---|---|---|---|
| `pagamento` | Pagamento ou carteira | high | 4 h | 2 dias | `payments.read` |
| `verificacao` | Verificação de identidade | normal | 24 h | 2 dias | — |
| `disputa` | Problema com um trabalho | high | 8 h | 5 dias | — |
| `denuncia` | Denúncia de utilizador | high | 8 h | 3 dias | `reports.moderate` |
| `conta` | Conta e acesso | normal | 8 h | 3 dias | — |
| `tecnico` | Erro na aplicação | normal | 24 h | 7 dias | — |
| `sugestao` | Sugestão ou ideia | low | 72 h | 14 dias | — |

Valores de SLA configuráveis em `ticket_categories` e `system_settings`.

**Estados:**
```
open ──► in_progress ──► waiting_customer ──► resolved ──► closed
  ▲            │                 │                │
  └────────────┴── resposta do utilizador ────────┘  (reabre)
```
- `open`: novo ou aguarda equipa. `in_progress`: atribuído e em análise. `waiting_customer`: equipa respondeu, aguarda utilizador. `resolved`: solução dada (utilizador pode reabrir respondendo em 5 dias). `closed`: final (auto após 5 dias ou manual).

**Regras:**
1. Só utilizadores autenticados abrem tickets. Máximo 5 abertos por utilizador.
2. O utilizador pode ligar o ticket a um trabalho, pagamento, pedido ou profissional **seus** (validado no servidor).
3. Notas internas nunca chegam ao utilizador (RLS + funções).
4. Anexos: JPG/PNG/WebP/PDF até 5 MB, máx. 5 por mensagem, bucket privado, URLs assinadas de 60 s, verificação de tipo real no servidor.
5. Número visível ao utilizador `TKT-1000`; a equipa vê também a URL interna.
6. Atribuição: manual ou "Assumir" (auto-atribuição). Regra de distribuição automática opcional (round-robin por categoria) na fase 12.
7. Prioridade pode ser subida pelo staff; mudanças ficam em `ticket_events`.
8. CSAT (1–5 + comentário) pedido ao resolver; alimenta relatórios.
9. Tickets de categoria restrita só são visíveis a quem tem a permissão da categoria.
10. Tickets nunca se apagam; RGPD: anonimização a pedido através de operação de superadmin com auditoria.
11. Ações sobre entidades ligadas (suspender, reembolsar, ajustar) fazem-se **a partir do ticket**, mas passam pelas funções e aprovações normais e registam o `ticket_id` em `audit_logs`.

---

## 6. SEGURANÇA (RLS E STORAGE)

Activar RLS em todas as tabelas novas. Políticas:

| Tabela | SELECT | Escrita |
|---|---|---|
| `permissions`, `role_permissions` | staff | só superadmin (`permissions.manage`) |
| `staff_profiles` | próprio + `staff.manage` | só `staff.manage` (sem auto-elevação: ninguém altera o próprio papel) |
| `staff_invitations` | `staff.manage` | `staff.manage` |
| `system_settings`, `feature_flags` | staff (flags públicas via endpoint) | `settings.manage` / `flags.manage` |
| `approval_requests` | quem pediu + quem pode decidir | só via funções |
| `impersonation_sessions` | staff próprio + superadmin | só via funções do servidor |
| `ticket_categories` | público (activas) | `admin`/superadmin |
| `tickets` | requester **ou** staff com `tickets.read` (respeitando `required_permission` da categoria) | criar via `create_ticket`; alterar só via funções |
| `ticket_messages` | requester (só `is_internal = false`) ou staff | só via `add_ticket_message` |
| `ticket_attachments` | como a mensagem | dono da mensagem |
| `ticket_events` | requester (só tipos públicos: created, status_changed, reopened) ou staff | só via funções |
| `ticket_macros` | staff | `tickets.macros.manage` |

Storage: bucket privado `ticket-attachments`; caminho `{ticket_id}/{uuid}-{nome}`; política liga o acesso ao ticket. Bloquear execução/inline de HTML; forçar `Content-Disposition: attachment`.

Middleware (Next.js) para `/admin/*` e `/superadmin/*`:
1. Sessão válida → senão `/entrar`.
2. `staff_profiles.is_active` → senão 403.
3. `must_change_password` → `/superadmin/definir-senha`.
4. `aal2` (MFA) → senão `/superadmin/mfa`.
5. Permissão da rota → senão 403 com página explicativa.
6. Cabeçalhos: `X-Frame-Options: DENY`, CSP restrita, `Cache-Control: no-store`.

Nunca confiar na interface: cada server action valida permissões novamente e usa as funções SQL acima.

---

## 7. INTERFACE

Seguir tokens e componentes de `BUEDEMESTRES_FRONTEND_DESIGN.md`. Áreas:

### 7.1 Utilizador (clientes e mestres)

- `/ajuda` — centro de ajuda: pesquisa de perguntas frequentes e botão "Abrir um pedido de ajuda".
- `/ajuda/tickets` — meus tickets (estado, última actualização, não lidas).
- `/ajuda/tickets/novo` — passos: categoria → detalhe (assunto, descrição, ligar a trabalho/pagamento com selector dos **seus** registos) → anexos → enviar. Botão final: **"Enviar pedido"** → toast "Pedido enviado. Número TKT-1000".
- `/ajuda/tickets/[numero]` — conversa (formato chat), linha do tempo de estados, anexos, botão "Marcar como resolvido", pedido de avaliação (estrelas) quando resolvido.
- Acesso rápido a partir de: perfil do mestre ("Denunciar"), trabalho ("Reportar problema"), carteira ("Problema com pagamento") com ligação pré-preenchida.

Copy de exemplo: vazio — "Ainda não abriste nenhum pedido de ajuda. Se algo correr mal, estamos aqui."; erro — "Não foi possível enviar o anexo. Usa uma imagem ou PDF até 5 MB."

### 7.2 Staff — `/admin/tickets`

- **Caixa de entrada** em tabela densa: nº, assunto, categoria, prioridade, estado, atribuído, SLA (contagem regressiva; vermelho se falhado), última actividade.
- **Vistas guardadas:** Não atribuídos · Meus · SLA em risco · Urgentes · Aguardam cliente · Todos. Filtros por categoria, estado, prioridade, atribuído, data, etiqueta. Pesquisa por nº, assunto ou utilizador.
- **Detalhe do ticket (duas colunas):**
  - Esquerda: cabeçalho (nº, estado, prioridade, atribuído), conversa e notas internas (fundo diferente), caixa de resposta com alternador "Resposta ao utilizador / Nota interna", macros (`/` abre lista), anexos.
  - Direita: painel do utilizador (perfil, papel, verificação, saldo, tickets anteriores), entidades ligadas (trabalho, pagamento, pedido, profissional) com atalhos e **acções contextuais** (suspender, confirmar pagamento, pedir ajuste) sujeitas a permissão.
  - Linha do tempo (`ticket_events`).
- Atalhos de teclado: `J/K` navegar, `R` responder, `N` nota, `A` assumir, `E` resolver.
- Actualização em tempo real (Supabase Realtime) da lista e do detalhe.

### 7.3 Superadmin — `/superadmin`

Barra superior em **óxido** com texto "Modo superadmin" e temporizador de sessão. Navegação lateral:

| Rota | Conteúdo |
|---|---|
| `/superadmin` | Saúde do sistema, pendentes, alertas |
| `/superadmin/equipa` | Lista de staff, convidar, papel, desactivar, terminar sessões |
| `/superadmin/permissoes` | Matriz papel × permissão, extras/revogadas por pessoa |
| `/superadmin/aprovacoes` | Pedidos pendentes (a mim / feitos por mim), aprovar/rejeitar com motivo |
| `/superadmin/configuracoes` | `system_settings` com validação e histórico |
| `/superadmin/flags` | Feature flags |
| `/superadmin/auditoria` | Pesquisa e exportação de `audit_logs` |
| `/superadmin/ver-como` | Iniciar visualização como utilizador (motivo obrigatório) |
| `/superadmin/seguranca` | Sessões, dispositivos, códigos de recuperação, IPs permitidos |
| `/superadmin/definir-senha` e `/superadmin/mfa` | Fluxos de primeiro acesso |

Acções destrutivas e sensíveis abrem folha de confirmação com step-up e resumo do impacto ("Vais congelar a carteira de X. O utilizador deixa de poder comprar planos.").

### 7.4 Componentes novos

`TicketTable`, `TicketThread`, `InternalNoteBubble`, `SlaBadge`, `PriorityPill`, `StatusPill`, `RelatedEntityPanel`, `MacroPicker`, `PermissionMatrix`, `ApprovalCard`, `StepUpDialog`, `ImpersonationBanner`, `AuditTable`, `SessionTimer`.

---

## 8. NOTIFICAÇÕES

| Evento | Destinatário | Canal |
|---|---|---|
| Ticket criado | Equipa da categoria | In-app + e-mail (resumo) |
| Resposta da equipa | Utilizador | In-app + e-mail |
| Resposta do utilizador | Atribuído (ou fila) | In-app |
| Ticket resolvido / prestes a fechar | Utilizador | In-app + e-mail |
| SLA a 80 % / falhado | Atribuído + `admin` | In-app + e-mail |
| Pedido de aprovação | Quem pode decidir | In-app + e-mail |
| Login em novo dispositivo (staff) | Titular | E-mail |
| Início de "ver como" | Superadmin (registo) | Auditoria |

E-mails: assunto `[TKT-1000] assunto`; nunca incluir dados sensíveis, apenas ligação à aplicação.

---

## 9. FASES DE IMPLEMENTAÇÃO

### Fase 10 — Base de staff e superadmin
- Migration `0100`: enums, `permissions`, `role_permissions`, `staff_profiles`, funções `is_staff` e `has_permission`, seeds de permissões e matriz.
- Script `bootstrap-superadmin.ts` (secção 3.1) e comando `npm run bootstrap:superadmin`.
- Middleware de staff (sessão, `is_active`, `must_change_password`, MFA `aal2`, permissão por rota).
- Páginas `definir-senha`, `mfa` (enrolamento TOTP + códigos de recuperação), layout `/admin` e `/superadmin` com barra em óxido.
- Convites e gestão de equipa; auditoria básica (`audit_logs` com IP e user-agent).
- **Aceitação:** o superadmin criado pelo script só entra após alterar a palavra-passe e activar MFA; a palavra-passe inicial não existe em nenhum ficheiro do repositório (`git grep` limpo); utilizador normal recebe 403 em `/superadmin`; ninguém altera o próprio papel.

### Fase 11 — Tickets: núcleo
- Migration de tickets (4.4), funções (4.5), RLS e bucket privado.
- Área do utilizador: abrir ticket, lista, conversa, anexos.
- Área de staff: caixa de entrada com vistas e filtros, detalhe, resposta, notas internas, atribuir, mudar estado.
- Notificações in-app + e-mail.
- **Aceitação:** utilizador A nunca vê tickets/mensagens/anexos de B; nota interna nunca aparece ao utilizador (teste RLS); estados mudam conforme o diagrama; limite de 5 abertos aplicado.

### Fase 12 — Tickets: SLA e produtividade
- Cálculo de SLA, cron de falhas e auto-fecho, indicadores `SlaBadge`.
- Macros, etiquetas, atalhos de teclado, tempo real, vistas guardadas, distribuição automática (round-robin por categoria, opcional).
- Painel do utilizador e entidades ligadas com acções contextuais (usando funções existentes).
- CSAT e relatório de suporte: volume, tempo de 1.ª resposta, tempo de resolução, % SLA cumprido, CSAT por categoria e por agente.
- **Aceitação:** ticket sem resposta além do SLA fica sinalizado em ≤ 5 min; resolvido sem resposta durante 5 dias fecha sozinho; relatório coincide com dados de teste conhecidos.

### Fase 13 — Superadmin avançado
- Aprovações com dupla decisão (4.6) e ajustes de carteira; limite configurável.
- `system_settings` e `feature_flags` com histórico e leitura pela aplicação (cache curto).
- Matriz de permissões editável; permissões extra/revogadas.
- "Ver como" só leitura com faixa, expiração e bloqueio de escrita.
- Auditoria completa com pesquisa/exportação (step-up + `data.export`).
- Operações de emergência: suspender, congelar carteira, revogar sessões, modo de manutenção.
- **Aceitação:** quem pede um ajuste não o consegue aprovar (erro da base de dados); durante "ver como" qualquer escrita falha; todas as acções aparecem em `audit_logs` com IP.

### Fase 14 — Endurecimento
- Rate limiting em login, criação de tickets e mensagens; bloqueio por tentativas falhadas; alertas por e-mail de segurança.
- Revisão de RLS (`select tablename from pg_tables where schemaname='public' and rowsecurity=false;` vazio), teste de permissões por papel, análise de dependências.
- Política de retenção (anexos de tickets fechados > 12 meses, documentos de verificação rejeitados > 30 dias).
- Ensaio de recuperação: perda de MFA do superadmin (procedimento documentado com códigos de recuperação e acesso ao servidor, nunca por interface pública).
- **Aceitação:** checklist de segurança assinada; teste de intrusão básico (IDOR em tickets, escalada de papel, upload malicioso) sem falhas.

---

## 10. TESTES OBRIGATÓRIOS

**SQL/RLS**
- `has_permission` respeita matriz, extras e revogadas; `superadmin` tem tudo; staff inactivo não tem nada.
- Ninguém altera o próprio `staff_role`.
- `approval_requests`: `requested_by = decided_by` falha; aprovação expirada falha; execução única (idempotente).
- Utilizador não lê mensagens internas nem tickets alheios; categoria restrita respeita `required_permission`.
- `create_ticket` rejeita ligação a trabalho/pagamento de outro utilizador.

**Integração**
- Script de arranque idempotente; não altera palavra-passe de superadmin existente; recusa `password` curta.
- Middleware: sem MFA → redirecciona; `must_change_password` → redirecciona.
- "Ver como": escrita bloqueada e sessão expira.

**E2E (Playwright)**
- Cliente abre ticket com anexo → agente responde → cliente responde → agente resolve → cliente avalia.
- Agente `support` tenta abrir `/superadmin` → 403.
- `finance` pede ajuste → superadmin aprova → saldo actualizado e auditoria registada.

**Segurança**
- Teste de que a palavra-passe inicial não aparece em código, logs de CI, `.next` nem histórico git.
- Upload de ficheiro com extensão trocada é rejeitado.

---

## 11. DEFINIÇÃO DE PRONTO

- Compila, lint e typecheck sem erros; migrations reversíveis.
- Toda a escrita passa por função SQL com verificação de permissão; RLS testado.
- Todas as acções de staff auditadas com actor, IP e (quando aplicável) `ticket_id`.
- Sem segredos no repositório.
- Interface responsiva a 360 px (área de utilizador) e utilizável em desktop (staff), em português de Moçambique.
- Estados de carregamento, vazio e erro em todos os ecrãs.

---

## 12. BACKLOG POSTERIOR

Chat em tempo real dentro do ticket com indicador "a escrever", entrada de tickets por e-mail e WhatsApp, base de conhecimento com artigos, sugestão de resposta por IA (rascunho para o agente rever, nunca envio automático), classificação e prioridade automáticas por IA, portal de estado do sistema, exportação anonimizada de relatórios, papéis personalizados criados pelo superadmin.
