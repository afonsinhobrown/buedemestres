-- Migration 0201: corrige a negociação de contra-propostas
-- Causa: jobs.request_id não tinha restrição única, pelo que todos os
-- upserts com { onConflict: 'request_id' } falhavam (erro 42P10).
-- Sem job, a inserção em job_price_proposals falhava (FK job_id -> jobs.id),
-- logo o mestre nunca recebia a contra-proposta do cliente.
-- Além disso, jobs não tinha coluna updated_at, apesar do código escrevê-la.

alter table jobs add column if not exists updated_at timestamptz not null default now();

-- Índice único NÃO-parcial para ser compatível com ON CONFLICT (request_id).
-- Postgres permite múltiplos NULL num índice único, pelo que jobs sem pedido continuam válidos.
create unique index if not exists jobs_request_id_uq on jobs (request_id);

create or replace trigger trg_jobs_upd
  before update on jobs
  for each row execute function set_updated_at();
