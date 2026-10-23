-- 0241: serializar a verificação de "um serviço activo por mestre"
-- Sem lock, dois aceites simultâneos podiam passar ambos na verificação antes
-- de qualquer um deles fazer commit (READ COMMITTED) e criar dois jobs activos.
-- O advisory lock por mestre elimina essa corrida.

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

  -- Serializa aceites do mesmo mestre até ao fim da transacção.
  perform pg_advisory_xact_lock(hashtextextended(new.provider_id::text, 0));

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
