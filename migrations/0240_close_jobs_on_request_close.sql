-- 0240: fechar automaticamente os jobs activos quando o pedido é cancelado/concluído
-- Alguns fluxos da app (ex.: cancelar um pedido em `accepted` em pedidos.tsx)
-- mudam apenas service_requests.status e deixavam o job do mestre "activo"
-- para sempre, bloqueando-o pelo novo trigger de um serviço por mestre.

create or replace function trg_close_jobs_on_request_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'cancelled' then
    update jobs
       set status = 'cancelled',
           cancel_reason = coalesce(cancel_reason, 'pedido_cancelado'),
           turn_owner = null,
           turn_expires_at = null,
           updated_at = now()
     where request_id = new.id
       and status = any(provider_active_job_statuses());
  elsif new.status = 'completed' then
    update jobs
       set status = 'completed',
           completed_at = coalesce(completed_at, now()),
           turn_owner = null,
           turn_expires_at = null,
           updated_at = now()
     where request_id = new.id
       and status = any(provider_active_job_statuses());
  end if;

  return new;
end $$;

drop trigger if exists requests_close_jobs on service_requests;
create trigger requests_close_jobs
  after update of status on service_requests
  for each row execute function trg_close_jobs_on_request_status();
