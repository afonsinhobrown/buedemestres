-- 4.4 Tickets
create sequence if not exists ticket_number_seq start 1000;

create table ticket_categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  default_priority ticket_priority not null default 'normal',
  first_response_minutes int not null default 480,
  resolution_minutes int not null default 4320,
  required_permission text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('ticket_number_seq'),
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
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index on ticket_messages(ticket_id, created_at);

create table ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  message_id uuid references ticket_messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes <= 5242880),
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table ticket_events (
  id bigserial primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  actor_id uuid references profiles(id),
  type text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on ticket_events(ticket_id, created_at);

create table ticket_macros (
  id serial primary key,
  title text not null,
  body text not null,
  category_id int references ticket_categories(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id)
);

create trigger trg_tickets_upd before update on tickets
for each row execute function set_updated_at();

-- 4.5 Funções

create or replace function create_ticket(
  p_category int, p_subject text, p_description text,
  p_job uuid default null, p_payment uuid default null,
  p_provider uuid default null, p_request uuid default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_cat ticket_categories; v_id uuid; v_number bigint;
begin
  select * into v_cat from ticket_categories where id = p_category and is_active;
  if not found then raise exception 'category_not_found'; end if;

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

-- 4.6 Aprovações financeiras (Ajustes de carteira)
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

-- RLS para as novas tabelas
alter table ticket_categories enable row level security;
alter table tickets enable row level security;
alter table ticket_messages enable row level security;
alter table ticket_attachments enable row level security;
alter table ticket_events enable row level security;

-- Categorias de tickets: visíveis para todos os autenticados
create policy "Ticket categories visible to authenticated" on ticket_categories for select to authenticated using (is_active);

-- Tickets: Utilizador vê os seus. Staff vê se tiver tickets.read
create policy "Users can view own tickets" on tickets for select to authenticated 
using (requester_id = auth.uid() or has_permission('tickets.read'));

-- Messages: Utilizador vê não internas. Staff vê todas.
create policy "Users can view own non-internal messages" on ticket_messages for select to authenticated
using ( (ticket_id in (select id from tickets where requester_id = auth.uid()) and not is_internal) or has_permission('tickets.read') );

-- Seed: Categorias Iniciais
insert into ticket_categories (slug, name, default_priority, first_response_minutes, resolution_minutes, required_permission) values
('pagamento', 'Pagamento ou carteira', 'high', 240, 2880, 'payments.read'),
('verificacao', 'Verificação de identidade', 'normal', 1440, 2880, null),
('disputa', 'Problema com um trabalho', 'high', 480, 7200, null),
('denuncia', 'Denúncia de utilizador', 'high', 480, 4320, 'reports.moderate'),
('conta', 'Conta e acesso', 'normal', 480, 4320, null),
('tecnico', 'Erro na aplicação', 'normal', 1440, 10080, null),
('sugestao', 'Sugestão ou ideia', 'low', 4320, 20160, null);
