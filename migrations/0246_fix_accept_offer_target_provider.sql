-- 0246: accept_offer tem de marcar o mestre no pedido (target_provider_id)
--
-- Problema: quando o mestre aceitava uma oferta (fluxo on-demand), o pedido
-- ficava com status='accepted' mas sem target_provider_id. A politica RLS de
-- UPDATE em service_requests exige client_id/target_provider_id = auth.uid(),
-- por isso a actualizacao feita em /trabalho/propor-preco (status
-- 'price_proposed' + budget_max) era bloqueada sem erro (0 linhas).
--
-- Resultado visivel: o cliente nunca recebia o orcamento no pedido; passados
-- os 10 minutos do turno, expire_stale_negotiations fechava o job e reabria o
-- pedido (status='open', target_provider_id=null). Ao abrir "Acompanhar
-- pedido" o cliente voltava a ver "A procurar mestre".

create or replace function accept_offer(p_offer uuid, p_eta_s int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_o request_offers; v_r service_requests; v_job uuid;
begin
  select * into v_o from request_offers
   where id = p_offer and provider_id = auth.uid() for update;
  if not found or v_o.status not in ('sent','viewed') or v_o.expires_at < now() then
    raise exception 'offer_unavailable';
  end if;

  select * into v_r from service_requests where id = v_o.request_id for update;
  if v_r.status <> 'open' then raise exception 'request_taken'; end if;

  if exists (select 1 from provider_presence where provider_id = auth.uid() and active_job_id is not null) then
    raise exception 'provider_busy';
  end if;

  update request_offers set status='accepted', responded_at=now(), eta_s = coalesce(p_eta_s, eta_s) where id = p_offer;
  update request_offers set status='cancelled', responded_at=now()
   where request_id = v_o.request_id and id <> p_offer and status in ('sent','viewed');

  -- Sem target_provider_id o mestre nao consegue gravar o orcamento no pedido.
  update service_requests
     set status='accepted', target_provider_id = auth.uid(), updated_at = now()
   where id = v_o.request_id;

  insert into jobs(request_id, client_id, provider_id, status, accepted_at, arrival_eta_s, pickup_location)
  values (v_r.id, v_r.client_id, auth.uid(), 'accepted', now(), coalesce(p_eta_s, v_o.eta_s), v_r.location)
  returning id into v_job;

  update provider_presence set active_job_id = v_job where provider_id = auth.uid();
  return v_job;
end $$;

-- Qualquer job criado para um pedido passa a marcar o mestre nesse pedido.
-- Isto cobre o fluxo manual (/api ... update service_requests) e o fluxo em
-- que o orcamento e enviado antes de o pedido ter sido marcado como aceite.
create or replace function trg_jobs_sync_request_target_provider()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.request_id is not null then
    update service_requests
       set target_provider_id = new.provider_id,
           updated_at = now()
     where id = new.request_id
       and target_provider_id is null;
  end if;
  return new;
end $$;

drop trigger if exists jobs_sync_request_target_provider on jobs;
create trigger jobs_sync_request_target_provider
after insert on jobs
for each row execute function trg_jobs_sync_request_target_provider();

-- Rede de seguranca na RLS: o mestre do job tambem pode actualizar o pedido,
-- mesmo que target_provider_id ainda nao esteja preenchido.
drop policy if exists "service_requests_update" on service_requests;
create policy "service_requests_update" on service_requests for update to authenticated
  using (
    client_id = auth.uid()
    or target_provider_id = auth.uid()
    or status = 'open'
    or exists (
      select 1 from jobs j
       where j.request_id = service_requests.id
         and j.provider_id = auth.uid()
    )
  )
  with check (
    client_id = auth.uid()
    or target_provider_id = auth.uid()
    or status = 'open'
    or (
      status in ('accepted','price_proposed','puxado','in_progress')
      and exists (
        select 1 from jobs j
         where j.request_id = service_requests.id
           and j.provider_id = auth.uid()
      )
    )
  );

-- 1. Reparar pedidos activos que ficaram sem mestre atribuido.
update service_requests r
   set target_provider_id = j.provider_id,
       updated_at = now()
  from jobs j
 where j.request_id = r.id
   and r.target_provider_id is null
   and r.status in ('accepted','price_proposed','puxado','in_progress')
   and j.status <> 'cancelled';

-- 2. Reparar orcamentos ja enviados que nao chegaram ao pedido.
--    So se o turno ainda nao expirou; caso contrario o job sera fechado pelo
--    expire_stale_negotiations e o pedido deve voltar ao pool normalmente.
update service_requests r
   set status = 'price_proposed',
       budget_max = p.amount,
       target_provider_id = j.provider_id,
       updated_at = now()
  from jobs j
  join lateral (
    select amount
      from job_price_proposals
     where job_id = j.id
       and proposed_by = j.provider_id
       and status = 'pending'
     order by created_at desc
     limit 1
  ) p on true
 where j.request_id = r.id
   and j.status = 'price_proposed'
   and r.status = 'accepted'
   and (j.turn_expires_at is null or j.turn_expires_at > now());
