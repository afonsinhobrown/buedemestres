-- 0221: subscrições de notificações push (web + apps móveis)
-- Guarda subscrições Web Push (PWA) e tokens Expo para iOS/Android.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  platform text not null check (platform in ('web', 'ios', 'android')),
  endpoint text,
  p256dh text,
  auth text,
  expo_token text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_target_check
    check ((endpoint is not null) <> (expo_token is not null))
);

alter table push_subscriptions
  add constraint push_subscriptions_web_uniq unique (profile_id, endpoint);
alter table push_subscriptions
  add constraint push_subscriptions_expo_uniq unique (profile_id, expo_token);

alter table notifications add column if not exists push_sent_at timestamptz;
create index if not exists notifications_push_pending_idx
  on notifications(created_at) where push_sent_at is null;

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on push_subscriptions;
create policy "push_subscriptions_select_own" on push_subscriptions
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on push_subscriptions;
create policy "push_subscriptions_insert_own" on push_subscriptions
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on push_subscriptions;
create policy "push_subscriptions_update_own" on push_subscriptions
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on push_subscriptions;
create policy "push_subscriptions_delete_own" on push_subscriptions
  for delete to authenticated using (profile_id = auth.uid());
