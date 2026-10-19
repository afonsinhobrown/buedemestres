-- 0231: Guarda de escrow, cancelamento pelo cliente e multas ao mestre
-- Objectivos:
--   * Proteger o CLIENTE: um pedido JÁ PAGO que estagna é cancelado e estornado.
--   * Dar autonomia: o cliente pode cancelar um pedido pago e escolher o destino
--     do estorno (carteira imediata ou devolução externa via PaySuite).
--   * Proteger a PLATAFORMA contra mestres que ficam com dinheiro parado: o mestre
--     tem carteira com saldo mínimo para operar; faltas geram multa debitada a
--     favor da plataforma.
--
-- Todos os valores são editáveis em app_settings (sem deploy).

-- 1. Novo tipo de transacção para multas --------------------------------------
alter type tx_type add value if not exists 'fine';

-- 2. Configuração (editável sem deploy) ---------------------------------------
insert into app_settings(key, value) values
  ('master_min_balance', '200'::jsonb),
  ('master_min_balance_enforced', 'true'::jsonb),
  ('fine_master_abandon', '150'::jsonb),
  ('escrow_idle_hours_unstarted', '2'::jsonb),
  ('escrow_idle_hours_in_service', '6'::jsonb),
  ('escrow_default_refund_destination', '"wallet"'::jsonb)
on conflict (key) do nothing;

create or replace function app_setting_numeric(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text::numeric from app_settings where key = p_key), p_default)
$$;

create or replace function app_setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text::boolean from app_settings where key = p_key), p_default)
$$;

create or replace function app_setting_text(p_key text, p_default text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select trim(both '"' from (value)::text) from app_settings where key = p_key), p_default)
$$;

-- 3. Saldo mínimo do mestre ---------------------------------------------------
create or replace function master_wallet_balance(p_provider uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select balance from wallets where profile_id = p_provider), 0)
$$;

create or replace function master_min_balance()
returns numeric language sql stable security definer set search_path = public as $$
  select app_setting_numeric('master_min_balance', 200)
$$;

-- O mestre só opera se tiver saldo suficiente para cobrir uma eventual multa.
create or replace function master_can_operate(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not app_setting_bool('master_min_balance_enforced', true)
      or master_wallet_balance(p_provider) >= master_min_balance()
$$;

-- Passa a exigir saldo mínimo além de não estar em cooldown.
create or replace function provider_can_accept(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not profile_on_cooldown(p_provider)
     and master_can_operate(p_provider)
$$;

-- 4. Estornos: registo auditável ----------------------------------------------
create table if not exists job_refunds (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  client_id uuid not null references profiles(id),
  amount numeric(12,2) not null check (amount >= 0),
  destination text not null check (destination in ('wallet','paysuite')),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  method payment_method,
  msisdn text,
  provider_ref text,
  reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists job_refunds_status_idx on job_refunds(status, created_at);
create index if not exists job_refunds_job_idx on job_refunds(job_id);

alter table job_refunds enable row level security;
drop policy if exists job_refunds_select_own on job_refunds;
create policy job_refunds_select_own on job_refunds
  for select to authenticated using (client_id = auth.uid());

-- 5. Multa ao mestre (a favor da plataforma) ----------------------------------
-- Debita o mínimo entre o saldo disponível e o valor da multa (a carteira nunca
-- fica negativa). O que não for coberto fica por cobrar e impede operar até o
-- mestre recarregar.
create or replace function charge_master_fine(
  p_provider uuid, p_job uuid, p_kind text, p_amount numeric
) returns numeric language plpgsql security definer set search_path = public as $$
declare v_bal numeric; v_take numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  insert into wallets(profile_id) values (p_provider) on conflict (profile_id) do nothing;

  select balance into v_bal from wallets where profile_id = p_provider for update;
  v_take := least(coalesce(v_bal, 0), p_amount);
  if v_take <= 0 then return 0; end if;

  perform wallet_apply(
    p_provider, 'fine', -v_take,
    case p_kind
      when 'cancelamento_apos_deslocacao' then 'Multa por cancelamento após deslocação'
      when 'pedido_abandonado' then 'Multa por pedido pago abandonado'
      else 'Multa da plataforma'
    end,
    null,
    jsonb_build_object('job_id', p_job, 'kind', p_kind, 'amount', p_amount)
  );

  insert into platform_revenue(kind, amount, job_id, profile_id)
  values ('fine', v_take, p_job, p_provider);

  return v_take;
end $$;

-- 6. Estorno de pagamento retido ----------------------------------------------
-- Devolve o valor retido (job_payments) e aditamentos retidos, escolhendo o
-- destino. O cliente pode não ter carteira ainda — é criada aqui.
create or replace function refund_held_job_payment(
  p_job uuid,
  p_destination text default 'wallet'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pay job_payments;
  v_amount numeric := 0;
  v_add numeric := 0;
  v_refund_id uuid;
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

  select coalesce(sum(amount), 0) into v_add
    from job_addenda where job_id = p_job and status in ('held','disputed');

  update job_payments
     set status = 'refunded', refunded_at = now()
   where id = v_pay.id;

  update job_addenda
     set status = 'refunded'
   where job_id = p_job and status in ('held','disputed');

  insert into job_refunds(job_id, client_id, amount, destination, status, reason)
  values (
    p_job, v_pay.client_id, v_amount + v_add, p_destination,
    case when p_destination = 'wallet' then 'completed' else 'pending' end,
    'estorno'
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

-- 7. Núcleo de fecho de um pedido pago ----------------------------------------
-- Estorna, fecha job/pedido, liberta o mestre e (opcionalmente) aplica multa.
create or replace function finalize_job_cancellation(
  p_job uuid,
  p_reason text,
  p_destination text,
  p_apply_fine boolean,
  p_fine_kind text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_refund jsonb;
  v_fine numeric := 0;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'job_not_found'); end if;

  v_refund := refund_held_job_payment(p_job, p_destination);

  update jobs
     set status = 'cancelled',
         cancel_reason = p_reason,
         turn_owner = null,
         turn_expires_at = null,
         updated_at = now()
   where id = p_job;

  update service_requests
     set status = 'cancelled', target_provider_id = null, updated_at = now()
   where id = v_job.request_id;

  update provider_presence set active_job_id = null where active_job_id = p_job;

  if p_apply_fine then
    v_fine := charge_master_fine(
      v_job.provider_id, p_job, p_fine_kind,
      app_setting_numeric('fine_master_abandon', 150)
    );
    begin
      perform register_abandon(v_job.provider_id, 'provider');
    exception when others then
      null;
    end;
  end if;

  insert into notifications(profile_id, type, title, body, data)
  values
    (v_job.client_id, 'job_cancelled', 'Pedido cancelado',
     'O pedido foi cancelado e o valor será estornado conforme o destino escolhido.',
     jsonb_build_object('job_id', p_job, 'reason', p_reason, 'refund', v_refund)),
    (v_job.provider_id, 'job_cancelled', 'Pedido cancelado',
     case when p_apply_fine
          then 'O pedido foi cancelado e foi-te aplicada uma multa. Verifica a tua carteira.'
          else 'O pedido foi cancelado.' end,
     jsonb_build_object('job_id', p_job, 'reason', p_reason, 'fine', v_fine));

  return jsonb_build_object('ok', true, 'refund', v_refund, 'fine', v_fine);
end $$;

-- 8. Cancelamento pelo cliente ------------------------------------------------
-- Só antes de o serviço iniciar. Se o mestre já se deslocou, leva multa.
-- Variante server-side (p_actor explícito) para a app web, que usa sessão JWT
-- própria; as apps móveis usam a versão com auth.uid().
create or replace function cancel_job_by_client_as(
  p_actor uuid, p_job uuid, p_destination text default 'wallet'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_job jobs; v_apply_fine boolean;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'job_not_found'); end if;
  if v_job.client_id <> p_actor then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_job.status not in ('price_agreed','en_route','arrived') then
    return jsonb_build_object('ok', false, 'error', 'cannot_cancel', 'status', v_job.status);
  end if;

  v_apply_fine := v_job.status in ('en_route','arrived');

  return finalize_job_cancellation(
    p_job, 'cancelado_cliente', p_destination, v_apply_fine,
    case when v_apply_fine then 'cancelamento_apos_deslocacao' else 'pedido_abandonado' end
  );
end $$;

create or replace function cancel_job_by_client(
  p_job uuid, p_destination text default 'wallet'
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return cancel_job_by_client_as(auth.uid(), p_job, p_destination);
end $$;

-- 9. Rede de segurança automática ---------------------------------------------
-- (a) Pago e o mestre não arrancou além do limite -> estorna + multa.
-- (b) Em serviço estagnado além do limite -> escala para disputa (admin decide).
create or replace function expire_stale_paid_jobs()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_j jobs;
  v_hours int;
  v_count int := 0;
  v_dest text;
begin
  v_dest := app_setting_text('escrow_default_refund_destination', 'wallet');
  if v_dest not in ('wallet','paysuite') then v_dest := 'wallet'; end if;

  -- (a) pago, mestre não iniciou (o relógio renova a cada ping de localização)
  v_hours := app_setting_int('escrow_idle_hours_unstarted', 2);
  for v_j in
    select j.* from jobs j
      join job_payments p on p.job_id = j.id and p.status = 'held'
     where j.status in ('price_agreed','en_route','arrived')
       and greatest(j.updated_at, coalesce(p.held_at, j.updated_at)) < now() - make_interval(hours => v_hours)
     for update of j skip locked
  loop
    perform finalize_job_cancellation(v_j.id, 'expirado_mestre', v_dest, true, 'pedido_abandonado');
    v_count := v_count + 1;
  end loop;

  -- (b) em serviço estagnado -> disputa para análise humana
  v_hours := app_setting_int('escrow_idle_hours_in_service', 6);
  for v_j in
    select j.* from jobs j
      join job_payments p on p.job_id = j.id and p.status = 'held'
     where j.status in ('in_service','in_progress')
       and greatest(j.updated_at, coalesce(p.held_at, j.updated_at)) < now() - make_interval(hours => v_hours)
     for update of j skip locked
  loop
    update job_payments set status = 'disputed' where job_id = v_j.id and status = 'held';
    update job_addenda set status = 'disputed' where job_id = v_j.id and status = 'held';
    update jobs set status = 'disputed', updated_at = now() where id = v_j.id;

    insert into tickets(
      requester_id, category_id, subject, description, status, priority, channel,
      related_job_id, related_provider_id, related_request_id,
      first_response_due, resolution_due
    )
    select v_j.client_id, tc.id,
           left('Serviço estagnado: ' || coalesce(r.title, 'Trabalho'), 120),
           'O serviço ficou mais de ' || v_hours || 'h sem progresso. Em análise pela equipa de apoio.',
           'open', 'high', 'app', v_j.id, v_j.provider_id, v_j.request_id,
           now() + make_interval(mins => tc.first_response_minutes),
           now() + make_interval(mins => tc.resolution_minutes)
      from ticket_categories tc
      left join service_requests r on r.id = v_j.request_id
     where tc.slug = 'disputa';

    insert into notifications(profile_id, type, title, body, data)
    values
      (v_j.client_id, 'service_stalled', 'Serviço em análise',
       'O serviço ficou parado demasiado tempo. A equipa de apoio vai analisar o caso.',
       jsonb_build_object('job_id', v_j.id)),
      (v_j.provider_id, 'service_stalled', 'Serviço em análise',
       'O serviço ficou parado demasiado tempo. A equipa de apoio vai analisar o caso.',
       jsonb_build_object('job_id', v_j.id));

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- 10. Agendamento (a cada 15 min) ---------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'escrow-idle-expire') then
      perform cron.unschedule('escrow-idle-expire');
    end if;
    perform cron.schedule('escrow-idle-expire', '*/15 * * * *',
      $cron$select expire_stale_paid_jobs();$cron$);
  end if;
exception when others then
  raise notice 'pg_cron indisponível, varredura será feita pela app: %', sqlerrm;
end $$;

-- 11. Permissões --------------------------------------------------------------
-- Funções que mexem em dinheiro: só o servidor (owner/service role) executa.
revoke execute on function refund_held_job_payment(uuid, text) from public, anon, authenticated;
revoke execute on function finalize_job_cancellation(uuid, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function charge_master_fine(uuid, uuid, text, numeric) from public, anon, authenticated;
revoke execute on function expire_stale_paid_jobs() from public, anon, authenticated;
revoke execute on function cancel_job_by_client_as(uuid, uuid, text) from public, anon, authenticated;

-- RPC do cliente (usa auth.uid()): apenas utilizadores autenticados.
revoke execute on function cancel_job_by_client(uuid, text) from public, anon;
grant execute on function cancel_job_by_client(uuid, text) to authenticated;
