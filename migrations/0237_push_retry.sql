-- 0237: controlo de tentativas de push para permitir retry quando não há entrega

alter table notifications
  add column if not exists push_attempts smallint not null default 0,
  add column if not exists push_last_error text;

create index if not exists notifications_push_pending_idx
  on notifications (created_at)
  where push_sent_at is null;
