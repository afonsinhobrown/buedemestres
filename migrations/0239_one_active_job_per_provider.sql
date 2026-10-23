-- 0239: Um mestre só pode ter um serviço activo de cada vez
-- O fluxo novo da app aceita pedidos com UPDATE directo e nunca passava pelo
-- `accept_offer` (0200), que era o único sítio a verificar `provider_busy`.
-- Resultado: o mesmo mestre conseguia ficar com vários jobs em simultâneo.
--
-- Regras:
--   * Considera-se activo: accepted, price_proposed, puxado, price_agreed,
--     en_route, arrived, in_service, in_progress, awaiting_confirmation.
--   * Jobs cujo pedido já está cancelled/completed não contam (dados obsoletos).
--   * Ao entrar num estado activo, um job novo é rejeitado com 'provider_busy'
--     se o mestre já tiver outro job activo. Transições dentro do estado activo
--     (ex.: price_proposed -> price_agreed) não são bloqueadas.
--   * provider_presence.active_job_id é sincronizado automaticamente.

create or replace function provider_active_job_statuses()
returns job_status[] language sql immutable as $$
  select array[
    'accepted','price_proposed','puxado','price_agreed','en_route',
    'arrived','in_service','in_progress','awaiting_confirmation'
  ]::job_status[]
$$;

create or replace function provider_has_active_job(
  p_provider uuid,
  p_exclude_request uuid default null
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from jobs j
      join service_requests r on r.id = j.request_id
     where j.provider_id = p_provider
       and j.status = any(provider_active_job_statuses())
       and coalesce(r.status::text, '') not in ('cancelled','completed')
       and (p_exclude_request is null or j.request_id <> p_exclude_request)
  )
$$;

-- Mantém a presença coerente com o job activo (usado pelo nearby_providers).
create or replace function sync_provider_active_job(p_provider uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_provider is null then return; end if;

  update provider_presence
     set active_job_id = (
       select j.id
         from jobs j
         join service_requests r on r.id = j.request_id
        where j.provider_id = p_provider
          and j.status = any(provider_active_job_statuses())
          and coalesce(r.status::text, '') not in ('cancelled','completed')
        order by j.created_at
        limit 1
     )
   where provider_id = p_provider;
end $$;

-- Bloqueia a criação/entrada de um segundo job activo.
create or replace function trg_one_active_job_per_provider()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_statuses job_status[] := provider_active_job_statuses();
begin
  if new.provider_id is null or not (new.status = any(v_statuses)) then
    return new;
  end if;

  -- Uma transição entre estados activos é continuação do mesmo serviço.
  if tg_op = 'UPDATE'
     and old.status = any(v_statuses)
     and old.provider_id = new.provider_id then
    return new;
  end if;

  if exists (
    select 1
      from jobs j
      join service_requests r on r.id = j.request_id
     where j.provider_id = new.provider_id
       and j.id <> new.id
       and j.request_id is distinct from new.request_id
       and j.status = any(v_statuses)
       and coalesce(r.status::text, '') not in ('cancelled','completed')
  ) then
    raise exception 'provider_busy';
  end if;

  return new;
end $$;

drop trigger if exists jobs_one_active_per_provider on jobs;
create trigger jobs_one_active_per_provider
  before insert or update of status, provider_id, request_id on jobs
  for each row execute function trg_one_active_job_per_provider();

-- Sincroniza a presença depois de qualquer alteração relevante ao job.
create or replace function trg_sync_provider_active_job()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform sync_provider_active_job(old.provider_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.provider_id is distinct from new.provider_id then
    perform sync_provider_active_job(old.provider_id);
  end if;

  perform sync_provider_active_job(new.provider_id);
  return new;
end $$;

drop trigger if exists jobs_sync_provider_active_job on jobs;
create trigger jobs_sync_provider_active_job
  after insert or update of status, provider_id on jobs
  for each row execute function trg_sync_provider_active_job();

drop trigger if exists jobs_sync_provider_active_job_del on jobs;
create trigger jobs_sync_provider_active_job_del
  after delete on jobs
  for each row execute function trg_sync_provider_active_job();

-- 1. Limpeza de dados obsoletos: jobs activos de pedidos já fechados -----------
update jobs j
   set status = 'cancelled',
       cancel_reason = coalesce(j.cancel_reason, 'pedido_original_cancelado'),
       updated_at = now()
  from service_requests r
 where r.id = j.request_id
   and r.status = 'cancelled'
   and j.status = any(provider_active_job_statuses());

update jobs j
   set status = 'completed',
       completed_at = coalesce(j.completed_at, now()),
       updated_at = now()
  from service_requests r
 where r.id = j.request_id
   and r.status = 'completed'
   and j.status = any(provider_active_job_statuses());

-- 2. Recalcular active_job_id de todos os mestres ------------------------------
do $$
declare v_provider uuid;
begin
  for v_provider in select distinct provider_id from provider_presence loop
    perform sync_provider_active_job(v_provider);
  end loop;
end $$;

-- 3. Permissões ----------------------------------------------------------------
revoke execute on function provider_active_job_statuses() from public, anon, authenticated;
revoke execute on function sync_provider_active_job(uuid) from public, anon, authenticated;
revoke execute on function provider_has_active_job(uuid, uuid) from public, anon;
grant execute on function provider_has_active_job(uuid, uuid) to authenticated;
