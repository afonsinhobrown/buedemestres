-- 0210: RLS real para as tabelas operacionais do fluxo.
-- As apps móveis usam sessão Supabase; as APIs web usam ligação direta (service role).
-- Todos os IDs de autorização vêm de auth.uid().

alter table profiles enable row level security;
alter table provider_profiles enable row level security;
alter table service_requests enable row level security;
alter table jobs enable row level security;
alter table job_price_proposals enable row level security;
alter table job_payments enable row level security;
alter table job_addenda enable row level security;
alter table notifications enable row level security;
alter table provider_presence enable row level security;
alter table request_offers enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table wallets enable row level security;
alter table reliability_stats enable row level security;
alter table tickets enable row level security;
alter table ticket_categories enable row level security;
alter table ticket_messages enable row level security;

-- profiles
drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated" on profiles for select to authenticated using (true);
drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- provider_profiles
drop policy if exists "provider_profiles_select_authenticated" on provider_profiles;
create policy "provider_profiles_select_authenticated" on provider_profiles for select to authenticated using (true);
drop policy if exists "provider_profiles_insert_self" on provider_profiles;
create policy "provider_profiles_insert_self" on provider_profiles for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists "provider_profiles_update_self" on provider_profiles;
create policy "provider_profiles_update_self" on provider_profiles for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- service_requests
drop policy if exists "Permitir tudo provisoriamente" on service_requests;
drop policy if exists "service_requests_select" on service_requests;
create policy "service_requests_select" on service_requests for select to authenticated
  using (client_id = auth.uid() or target_provider_id = auth.uid() or status = 'open');
drop policy if exists "service_requests_insert_client" on service_requests;
create policy "service_requests_insert_client" on service_requests for insert to authenticated
  with check (client_id = auth.uid());
drop policy if exists "service_requests_update" on service_requests;
create policy "service_requests_update" on service_requests for update to authenticated
  using (client_id = auth.uid() or target_provider_id = auth.uid() or status = 'open')
  with check (
    client_id = auth.uid()
    or target_provider_id = auth.uid()
    or (status in ('accepted','price_proposed','puxado','in_progress') and target_provider_id = auth.uid())
  );
drop policy if exists "service_requests_delete_client" on service_requests;
create policy "service_requests_delete_client" on service_requests for delete to authenticated
  using (client_id = auth.uid());

-- jobs
drop policy if exists "jobs_select_participant" on jobs;
create policy "jobs_select_participant" on jobs for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid());
drop policy if exists "jobs_insert_participant" on jobs;
create policy "jobs_insert_participant" on jobs for insert to authenticated
  with check (client_id = auth.uid() or provider_id = auth.uid());
drop policy if exists "jobs_update_participant" on jobs;
create policy "jobs_update_participant" on jobs for update to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid())
  with check (client_id = auth.uid() or provider_id = auth.uid());

-- job_price_proposals
drop policy if exists "proposals_select_participant" on job_price_proposals;
create policy "proposals_select_participant" on job_price_proposals for select to authenticated
  using (exists (select 1 from jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));
drop policy if exists "proposals_insert_author" on job_price_proposals;
create policy "proposals_insert_author" on job_price_proposals for insert to authenticated
  with check (
    proposed_by = auth.uid()
    and exists (select 1 from jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid()))
  );
drop policy if exists "proposals_update_participant" on job_price_proposals;
create policy "proposals_update_participant" on job_price_proposals for update to authenticated
  using (exists (select 1 from jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())))
  with check (exists (select 1 from jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));

-- job_payments
drop policy if exists "payments_select_participant" on job_payments;
create policy "payments_select_participant" on job_payments for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid());

-- job_addenda
drop policy if exists "addenda_select_participant" on job_addenda;
create policy "addenda_select_participant" on job_addenda for select to authenticated
  using (exists (select 1 from jobs j where j.id = job_id and (j.client_id = auth.uid() or j.provider_id = auth.uid())));

-- notifications
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select to authenticated
  using (profile_id = auth.uid());
drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "notifications_insert_authenticated" on notifications;
create policy "notifications_insert_authenticated" on notifications for insert to authenticated
  with check (true);

-- provider_presence
drop policy if exists "presence_select_authenticated" on provider_presence;
create policy "presence_select_authenticated" on provider_presence for select to authenticated using (true);
drop policy if exists "presence_write_self" on provider_presence;
create policy "presence_write_self" on provider_presence for all to authenticated
  using (provider_id = auth.uid()) with check (provider_id = auth.uid());

-- request_offers
drop policy if exists "offers_select_related" on request_offers;
create policy "offers_select_related" on request_offers for select to authenticated
  using (
    provider_id = auth.uid()
    or exists (select 1 from service_requests r where r.id = request_id and r.client_id = auth.uid())
  );
drop policy if exists "offers_write_self" on request_offers;
create policy "offers_write_self" on request_offers for all to authenticated
  using (provider_id = auth.uid()) with check (provider_id = auth.uid());

-- conversations
drop policy if exists "conversations_participant" on conversations;
create policy "conversations_participant" on conversations for all to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid())
  with check (client_id = auth.uid() or provider_id = auth.uid());

-- messages
drop policy if exists "messages_select_participant" on messages;
create policy "messages_select_participant" on messages for select to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())));
drop policy if exists "messages_insert_sender" on messages;
create policy "messages_insert_sender" on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid()))
  );
drop policy if exists "messages_update_participant" on messages;
create policy "messages_update_participant" on messages for update to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())))
  with check (exists (select 1 from conversations c where c.id = conversation_id and (c.client_id = auth.uid() or c.provider_id = auth.uid())));

-- reviews
drop policy if exists "reviews_select_authenticated" on reviews;
create policy "reviews_select_authenticated" on reviews for select to authenticated using (true);
drop policy if exists "reviews_insert_client" on reviews;
create policy "reviews_insert_client" on reviews for insert to authenticated
  with check (
    client_id = auth.uid()
    and exists (select 1 from jobs j where j.id = job_id and j.client_id = auth.uid() and j.provider_id = provider_id and j.status = 'completed')
  );

-- wallets
drop policy if exists "wallets_select_own" on wallets;
create policy "wallets_select_own" on wallets for select to authenticated using (profile_id = auth.uid());

-- reliability_stats
drop policy if exists "reliability_select_own" on reliability_stats;
create policy "reliability_select_own" on reliability_stats for select to authenticated using (profile_id = auth.uid());

-- tickets / categorias / mensagens de ticket
drop policy if exists "ticket_categories_select_authenticated" on ticket_categories;
create policy "ticket_categories_select_authenticated" on ticket_categories for select to authenticated using (is_active);
drop policy if exists "tickets_insert_own" on tickets;
create policy "tickets_insert_own" on tickets for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "ticket_messages_insert_own" on ticket_messages;
create policy "ticket_messages_insert_own" on ticket_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from tickets t where t.id = ticket_id and t.requester_id = auth.uid())
  );
