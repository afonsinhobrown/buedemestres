-- 0232: Estornos automáticos via PaySuite (fecho do circuito de reembolso)
-- A 0231 deixou os estornos com destino 'paysuite' em 'pending' à espera de um
-- executor. Esta migração fecha esse circuito:
--   * guarda o id do pagamento PaySuite (payment_id) no retido, para podermos
--     pedir o reembolso em POST /api/v1/refunds;
--   * alarga os estados de job_refunds para refletir o ciclo da PaySuite
--     (pending -> processing -> completed | failed);
--   * liga o job_refund ao job_payment/aditamento para o worker saber o valor
--     e o método originais.
--
-- Nada fica pendente: o worker (api/refunds/dispatch-pending) envia e reconcilia,
-- e o webhook (refund.success/refund.failed) confirma ou falha cada estorno.

-- 1. Guardar o id do pagamento PaySuite --------------------------------------
alter table job_payments add column if not exists provider_payment_id text;
alter table job_addenda add column if not exists provider_payment_id text;

-- Preenche o id do pagamento quando o pagamento é retido. A app passa o id
-- devolvido por createPaySuiteCharge (charge.id); se faltar, fica null e o
-- worker resolve-o pela referência.
create or replace function set_job_payment_provider_id(p_payment uuid, p_payment_id text)
returns void language sql security definer set search_path = public as $$
  update job_payments set provider_payment_id = coalesce(p_payment_id, provider_payment_id)
   where id = p_payment
$$;

create or replace function set_addendum_provider_payment_id(p_addendum uuid, p_payment_id text)
returns void language sql security definer set search_path = public as $$
  update job_addenda set provider_payment_id = coalesce(p_payment_id, provider_payment_id)
   where id = p_addendum
$$;

-- 2. job_refunds: ciclo completo da PaySuite ---------------------------------
-- Alarga o check de estados (pending/processing/completed/failed) e acrescenta
-- rastreio do reembolso externo.
alter table job_refunds
  add column if not exists payment_id text,
  add column if not exists failure_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table job_refunds drop constraint if exists job_refunds_status_check;
alter table job_refunds
  add constraint job_refunds_status_check
  check (status in ('pending','processing','completed','failed'));

create or replace function trg_job_refunds_upd() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_job_refunds_updated on job_refunds;
create trigger trg_job_refunds_updated
  before update on job_refunds
  for each row execute function trg_job_refunds_upd();

-- 3. Estorno (0231) preenche o método e o payment_id conhecidos --------------
create or replace function refund_held_job_payment(
  p_job uuid,
  p_destination text default 'wallet'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pay job_payments;
  v_amount numeric := 0;
  v_add numeric := 0;
  v_refund_id uuid;
  v_msisdn text;
begin
  if p_destination not in ('wallet','paysuite') then
    raise exception 'invalid_destination';
  end if;

  select * into v_pay from job_payments where job_id = p_job for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'payment_not_found'); end if;
  if v_pay.status not in ('held','disputed') then
    return jsonb_build_object('ok', false, 'error', 'payment_not_held', 'status', v_pay.status);
  end if;

  v_amount := v_pay.amount;
  v_msisdn := v_pay.msisdn;

  select coalesce(sum(amount), 0) into v_add
    from job_addenda where job_id = p_job and status in ('held','disputed');

  update job_payments
     set status = 'refunded', refunded_at = now()
   where id = v_pay.id;

  update job_addenda
     set status = 'refunded'
   where job_id = p_job and status in ('held','disputed');

  insert into job_refunds(
    job_id, client_id, amount, destination, status, method, msisdn,
    payment_id, reason
  )
  values (
    p_job, v_pay.client_id, v_amount + v_add, p_destination,
    case when p_destination = 'wallet' then 'completed' else 'pending' end,
    v_pay.method, v_msisdn, v_pay.provider_payment_id, 'estorno'
  )
  returning id into v_refund_id;

  if p_destination = 'wallet' then
    insert into wallets(profile_id) values (v_pay.client_id)
      on conflict (profile_id) do nothing;
    perform wallet_apply(
      v_pay.client_id, 'refund', v_amount + v_add, 'Estorno de pedido',
      null, jsonb_build_object('job_id', p_job, 'refund_id', v_refund_id)
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'amount', v_amount + v_add,
    'destination', p_destination, 'refund_id', v_refund_id
  );
end $$;

-- 4. Reclamação/desfecho de um estorno PaySuite ------------------------------
-- O worker reclama (pending -> processing) antes de enviar; o webhook confirma
-- ou falha. Tudo idempotente.
create or replace function claim_job_refund(p_refund uuid, p_payment_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  update job_refunds
     set status = 'processing',
         payment_id = coalesce(p_payment_id, payment_id),
         failure_reason = null
   where id = p_refund and status = 'pending'
  returning status into v_status;
  if not found then
    select status into v_status from job_refunds where id = p_refund;
    if not found then return 'not_found'; end if;
    return v_status;
  end if;
  return 'processing';
end $$;

create or replace function complete_job_refund(p_refund uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_row job_refunds;
begin
  select * into v_row from job_refunds where id = p_refund for update;
  if not found then return 'not_found'; end if;
  if v_row.status = 'completed' then return 'already'; end if;

  update job_refunds
     set status = 'completed', completed_at = now(), failure_reason = null
   where id = p_refund;

  insert into notifications(profile_id, type, title, body, data)
  values (
    v_row.client_id, 'refund_completed', 'Estorno concluído',
    'O estorno de MT ' || v_row.amount || ' foi enviado para o teu método de pagamento.',
    jsonb_build_object('job_id', v_row.job_id, 'refund_id', v_row.id)
  );
  return 'completed';
end $$;

-- Falha um estorno. Como o destino era 'paysuite' (dinheiro não entrou na
-- carteira), devolve o valor à carteira do cliente para que nunca fique preso.
create or replace function fail_job_refund(p_refund uuid, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare v_row job_refunds;
begin
  select * into v_row from job_refunds where id = p_refund for update;
  if not found then return 'not_found'; end if;
  if v_row.status in ('completed','failed') then return 'already'; end if;

  update job_refunds
     set status = 'failed', failure_reason = coalesce(p_reason, 'Falha no estorno')
   where id = p_refund;

  insert into wallets(profile_id) values (v_row.client_id)
    on conflict (profile_id) do nothing;
  perform wallet_apply(
    v_row.client_id, 'refund', v_row.amount,
    'Estorno via PaySuite falhou — devolvido à carteira',
    null, jsonb_build_object('job_id', v_row.job_id, 'refund_id', v_row.id)
  );

  insert into notifications(profile_id, type, title, body, data)
  values (
    v_row.client_id, 'refund_failed', 'Estorno alternativo efetuado',
    'O estorno externo falhou; o valor de MT ' || v_row.amount || ' foi devolvido à tua carteira.',
    jsonb_build_object('job_id', v_row.job_id, 'refund_id', v_row.id)
  );
  return 'failed';
end $$;

-- Lista de estornos a processar/reconciliar (para o worker).
create or replace function job_refunds_pending(p_limit int default 20)
returns table (
  id uuid, job_id uuid, client_id uuid, amount numeric,
  method text, msisdn text, payment_id text, status text
) language sql stable security definer set search_path = public as $$
  select r.id, r.job_id, r.client_id, r.amount,
         r.method::text, r.msisdn, r.payment_id, r.status
    from job_refunds r
   where r.destination = 'paysuite'
     and r.status in ('pending','processing')
   order by r.created_at asc
   limit p_limit
$$;

create or replace function job_refunds_processing(p_limit int default 20)
returns table (id uuid, payment_id text, status text)
language sql stable security definer set search_path = public as $$
  select r.id, r.payment_id, r.status
    from job_refunds r
   where r.destination = 'paysuite'
     and r.status = 'processing'
     and r.payment_id is not null
   order by r.updated_at asc
   limit p_limit
$$;

-- 5. Permissões --------------------------------------------------------------
revoke execute on function set_job_payment_provider_id(uuid, text) from public, anon, authenticated;
revoke execute on function set_addendum_provider_payment_id(uuid, text) from public, anon, authenticated;
revoke execute on function refund_held_job_payment(uuid, text) from public, anon, authenticated;
revoke execute on function claim_job_refund(uuid, text) from public, anon, authenticated;
revoke execute on function complete_job_refund(uuid) from public, anon, authenticated;
revoke execute on function fail_job_refund(uuid, text) from public, anon, authenticated;
revoke execute on function job_refunds_pending(int) from public, anon, authenticated;
revoke execute on function job_refunds_processing(int) from public, anon, authenticated;

-- 6. Worker automático (PaySuite Refunds) ------------------------------------
-- Reutiliza o segredo do push_dispatch. Ao criar um estorno pendente, dispara
-- já; e o cron reconcilia/reenvia a cada minuto.
create or replace function dispatch_refunds_worker()
returns void language plpgsql security definer set search_path = public as $body$
declare
  v_url text;
  v_secret text;
begin
  select value->>'url' into v_url from app_settings where key = 'refund_dispatch';
  select value->>'secret' into v_secret from app_settings where key = 'push_dispatch';

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end $body$;

do $setup$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    insert into app_settings(key, value)
    select
      'refund_dispatch',
      jsonb_build_object(
        'url',
        replace(value->>'url', '/api/push/dispatch', '/api/refunds/dispatch-pending')
      )
    from app_settings
    where key = 'push_dispatch'
      and coalesce(value->>'url', '') <> ''
    on conflict (key) do update set value = excluded.value, updated_at = now();

    insert into app_settings(key, value)
    values (
      'refund_dispatch',
      '{"url":"https://buedemestres.vercel.app/api/refunds/dispatch-pending"}'::jsonb
    )
    on conflict (key) do nothing;
  end if;
exception when others then
  raise notice 'refund dispatch config indisponível: %', sqlerrm;
end $setup$;

create or replace function trg_refund_dispatch()
returns trigger language plpgsql security definer set search_path = public as $body$
begin
  if new.status = 'pending' and new.destination = 'paysuite' then
    begin
      perform dispatch_refunds_worker();
    exception when others then
      null;
    end;
  end if;
  return new;
end $body$;

drop trigger if exists refunds_dispatch on job_refunds;
create trigger refunds_dispatch
  after insert on job_refunds
  for each row execute function trg_refund_dispatch();

do $cron_setup$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'refund-dispatch') then
      perform cron.unschedule('refund-dispatch');
    end if;
    perform cron.schedule('refund-dispatch', '* * * * *',
      $cron$select dispatch_refunds_worker()$cron$);
  end if;
exception when others then
  raise notice 'pg_cron indisponível para refunds: %', sqlerrm;
end $cron_setup$;
