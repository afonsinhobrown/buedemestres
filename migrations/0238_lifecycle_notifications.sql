-- 0238: notificações automáticas de todo o ciclo de vida do pedido/serviço
-- Cobre: novo pedido, aceitação, deslocação, chegada, início, conclusão,
-- confirmação do cliente, cancelamentos, pagamentos/escrow, aditamentos e carregamentos.

create or replace function notify_user(
  p_profile uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_profile is null then
    return;
  end if;
  insert into notifications (profile_id, type, title, body, data)
  values (p_profile, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
end $$;

-- ===== Novo pedido =====
create or replace function notify_new_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'open' then
    return new;
  end if;

  if new.target_provider_id is not null then
    perform notify_user(
      new.target_provider_id,
      'new_request',
      'Novo pedido de serviço',
      coalesce(nullif(new.title, ''), 'Tens um novo pedido na tua área.'),
      jsonb_build_object('requestId', new.id, 'jobId', new.id, 'url', '/')
    );
    return new;
  end if;

  insert into notifications (profile_id, type, title, body, data)
  select distinct
         pr.provider_id,
         'new_request',
         'Novo pedido de serviço',
         coalesce(nullif(new.title, ''), 'Novo pedido na tua categoria.'),
         jsonb_build_object('requestId', new.id, 'jobId', new.id, 'url', '/')
    from provider_presence pr
    join provider_profiles pp on pp.profile_id = pr.provider_id
   where pr.is_online
     and pr.updated_at > now() - interval '90 seconds'
     and pp.is_published
     and pp.verification = 'approved'
     and new.category_id = any(pr.categories);

  return new;
end $$;

drop trigger if exists trg_notify_new_request on service_requests;
create trigger trg_notify_new_request
  after insert on service_requests
  for each row execute function notify_new_request();

-- ===== Pedido cancelado =====
create or replace function notify_request_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job_id uuid;
  v_provider uuid;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;

  select j.id, j.provider_id into v_job_id, v_provider
    from jobs j
   where j.request_id = new.id
   order by j.created_at desc
   limit 1;

  v_provider := coalesce(v_provider, new.target_provider_id);

  perform notify_user(
    v_provider,
    'request_cancelled',
    'Pedido cancelado',
    'O cliente cancelou o pedido.',
    jsonb_build_object('requestId', new.id, 'jobId', coalesce(v_job_id, new.id), 'url', '/trabalhos')
  );

  return new;
end $$;

drop trigger if exists trg_notify_request_cancelled on service_requests;
create trigger trg_notify_request_cancelled
  after update of status on service_requests
  for each row execute function notify_request_cancelled();

-- ===== Job criado: mestre aceitou =====
create or replace function notify_job_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_user(
    new.client_id,
    'request_accepted',
    'Mestre aceitou o teu pedido',
    'O teu pedido foi aceite. Acompanha a chegada do mestre.',
    jsonb_build_object('jobId', new.id, 'requestId', new.request_id, 'url', '/pedido/mestre-a-caminho')
  );
  return new;
end $$;

drop trigger if exists trg_notify_job_created on jobs;
create trigger trg_notify_job_created
  after insert on jobs
  for each row execute function notify_job_created();

-- ===== Estados do job =====
create or replace function notify_job_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb := jsonb_build_object('jobId', new.id, 'requestId', new.request_id);
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'en_route' then
    perform notify_user(new.client_id, 'master_en_route', 'Mestre a caminho',
      'O mestre iniciou a deslocação para o teu local.', v_data);
  elsif new.status = 'arrived' then
    perform notify_user(new.client_id, 'master_arrived', 'Mestre chegou',
      'O mestre chegou ao local combinado.', v_data);
  elsif new.status = 'in_service' then
    perform notify_user(new.client_id, 'service_started', 'Serviço iniciado',
      'O mestre confirmou o início do serviço.', v_data);
  elsif new.status = 'awaiting_confirmation' then
    perform notify_user(new.client_id, 'service_finished', 'Serviço concluído',
      'O mestre terminou o serviço. Confirma a conclusão para libertar o pagamento.', v_data);
  elsif new.status = 'completed' then
    perform notify_user(new.provider_id, 'job_completed', 'Cliente confirmou a conclusão',
      'O cliente confirmou o serviço concluído. O teu pagamento vai ser libertado.', v_data);
  elsif new.status = 'cancelled' then
    perform notify_user(new.client_id, 'job_cancelled', 'Serviço cancelado',
      coalesce(nullif(new.cancel_reason, ''), 'O serviço foi cancelado.'), v_data);
    perform notify_user(new.provider_id, 'job_cancelled', 'Serviço cancelado',
      coalesce(nullif(new.cancel_reason, ''), 'O serviço foi cancelado.'), v_data);
  elsif new.status = 'disputed' then
    perform notify_user(new.client_id, 'dispute_opened', 'Disputa aberta',
      'A disputa do serviço foi registada. A equipa vai analisar.', v_data);
    perform notify_user(new.provider_id, 'dispute_opened', 'Disputa aberta',
      'O cliente abriu uma disputa. A equipa vai analisar.', v_data);
  end if;

  return new;
end $$;

drop trigger if exists trg_notify_job_status on jobs;
create trigger trg_notify_job_status
  after update of status on jobs
  for each row execute function notify_job_status();

-- ===== Pagamentos / escrow =====
create or replace function notify_job_payment_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb := jsonb_build_object('jobId', new.job_id, 'paymentId', new.id);
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'held' then
    perform notify_user(new.provider_id, 'payment_held', 'Pagamento retido!',
      'O cliente pagou MT ' || new.amount || '. Podes iniciar o serviço.', v_data);
    perform notify_user(new.client_id, 'payment_confirmed', 'Pagamento confirmado e retido',
      'O pagamento de MT ' || new.amount || ' está retido até confirmares a conclusão.', v_data);
  elsif new.status = 'released' then
    perform notify_user(new.provider_id, 'payment_released', 'Pagamento libertado',
      'O cliente confirmou a conclusão. MT ' || new.provider_payout || ' foram libertados.', v_data);
  elsif new.status = 'refunded' then
    perform notify_user(new.client_id, 'payment_refunded', 'Pagamento reembolsado',
      'O pagamento de MT ' || new.amount || ' foi reembolsado.', v_data);
    perform notify_user(new.provider_id, 'payment_refunded', 'Pagamento reembolsado',
      'O pagamento do serviço foi reembolsado ao cliente.', v_data);
  elsif new.status = 'failed' then
    perform notify_user(new.provider_id, 'payment_failed', 'Pagamento não concluído',
      'O cliente não concluiu o pagamento. Não inicies a deslocação.', v_data);
  end if;

  return new;
end $$;

drop trigger if exists trg_notify_job_payment_status on job_payments;
create trigger trg_notify_job_payment_status
  after update of status on job_payments
  for each row execute function notify_job_payment_status();

-- ===== Aditamentos =====
create or replace function notify_addendum_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_data jsonb;
begin
  if new.status = old.status then
    return new;
  end if;

  select * into v_job from jobs where id = new.job_id;
  if v_job.id is null then
    return new;
  end if;

  v_data := jsonb_build_object('jobId', new.job_id, 'addendumId', new.id);

  if new.status = 'held' then
    perform notify_user(v_job.provider_id, 'addendum_paid', 'Aditamento pago',
      'O cliente pagou um aditamento de MT ' || new.amount || '.', v_data);
    perform notify_user(v_job.client_id, 'addendum_paid', 'Aditamento confirmado',
      'O aditamento de MT ' || new.amount || ' foi pago e retido.', v_data);
  elsif new.status = 'released' then
    perform notify_user(v_job.provider_id, 'addendum_released', 'Aditamento libertado',
      'O aditamento de MT ' || new.provider_payout || ' foi libertado.', v_data);
  elsif new.status = 'refunded' then
    perform notify_user(v_job.client_id, 'addendum_failed', 'Aditamento reembolsado',
      'O aditamento de MT ' || new.amount || ' foi reembolsado.', v_data);
    perform notify_user(v_job.provider_id, 'addendum_failed', 'Aditamento reembolsado',
      'O aditamento foi reembolsado ao cliente.', v_data);
  elsif new.status = 'failed' then
    perform notify_user(v_job.provider_id, 'addendum_failed', 'Aditamento não pago',
      'O pagamento do aditamento não foi concluído.', v_data);
    perform notify_user(v_job.client_id, 'addendum_failed', 'Pagamento do aditamento não concluído',
      'O pagamento do aditamento de MT ' || new.amount || ' não foi concluído.', v_data);
  end if;

  return new;
end $$;

drop trigger if exists trg_notify_addendum_status on job_addenda;
create trigger trg_notify_addendum_status
  after update of status on job_addenda
  for each row execute function notify_addendum_status();

-- ===== Carregamento de saldo =====
create or replace function notify_payment_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'completed' then
    perform notify_user(new.profile_id, 'wallet_topup', 'Saldo carregado',
      'O teu saldo foi carregado com MT ' || new.amount || '.',
      jsonb_build_object('paymentId', new.id, 'url', '/carteira'));
  elsif new.status = 'failed' then
    perform notify_user(new.profile_id, 'wallet_topup_failed', 'Carregamento não concluído',
      'O carregamento de MT ' || new.amount || ' não foi concluído.',
      jsonb_build_object('paymentId', new.id, 'url', '/carregar'));
  end if;

  return new;
end $$;

drop trigger if exists trg_notify_payment_status on payments;
create trigger trg_notify_payment_status
  after update of status on payments
  for each row execute function notify_payment_status();
