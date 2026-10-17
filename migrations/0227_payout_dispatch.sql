-- 0227: envio automÃ¡tico de saques (PaySuite Payouts)
-- * trigger: ao criar um payout pending, sinaliza o worker imediatamente
-- * cron: a cada minuto envia pendentes e reconcilia os que estÃ£o em processamento
-- O segredo reutiliza o push_dispatch (x-push-secret), jÃ¡ configurado.

create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into app_settings(key, value)
select
  'payout_dispatch',
  jsonb_build_object(
    'url',
    replace(value->>'url', '/api/push/dispatch', '/api/payouts/dispatch-pending')
  )
from app_settings
where key = 'push_dispatch'
  and coalesce(value->>'url', '') <> ''
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into app_settings(key, value)
values (
  'payout_dispatch',
  '{"url":"https://buedemestres.vercel.app/api/payouts/dispatch-pending"}'::jsonb
)
on conflict (key) do nothing;

create or replace function dispatch_payouts_worker()
returns void language plpgsql security definer set search_path = public, net as $$
declare
  v_url text;
  v_secret text;
begin
  select value->>'url' into v_url from app_settings where key = 'payout_dispatch';
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
end $$;

create or replace function trg_payout_dispatch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform dispatch_payouts_worker();
  end if;
  return new;
end $$;

drop trigger if exists payouts_dispatch on payouts;
create trigger payouts_dispatch
  after insert on payouts
  for each row execute function trg_payout_dispatch();

select cron.unschedule('payout-dispatch')
where exists (select 1 from cron.job where jobname = 'payout-dispatch');

select cron.schedule('payout-dispatch', '* * * * *', $$select dispatch_payouts_worker()$$);

-- permitir novo pedido quando o anterior falhou (o valor já foi devolvido)
create or replace function request_job_payout(p_job uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_pay job_payments;
  v_acc provider_payout_accounts;
  v_old payouts;
  v_payout_id uuid;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found then raise exception 'job_not_found'; end if;
  if v_job.provider_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if v_job.status <> 'completed' then raise exception 'job_not_completed'; end if;

  select * into v_pay from job_payments where job_id = p_job for update;
  if not found or v_pay.status <> 'released' then raise exception 'payment_not_released'; end if;

  select * into v_old from payouts where job_id = p_job for update;
  if found then
    if v_old.status = 'failed' then
      delete from payouts where id = v_old.id;
    else
      raise exception 'already_requested';
    end if;
  end if;

  select * into v_acc from provider_payout_accounts where profile_id = auth.uid();
  if not found then raise exception 'payout_account_missing'; end if;

  insert into payouts(
    provider_id, amount, method, msisdn, status, job_id,
    account_name, bank_name, account_number
  ) values (
    auth.uid(), v_pay.provider_payout, v_acc.method, v_acc.msisdn, 'pending', p_job,
    v_acc.account_name, v_acc.bank_name, v_acc.account_number
  ) returning id into v_payout_id;

  perform wallet_apply(
    auth.uid(), 'withdrawal', -v_pay.provider_payout,
    'Pedido de saque do serviço', null,
    jsonb_build_object('job_id', p_job, 'payout_id', v_payout_id)
  );

  return v_payout_id;
end $$;

revoke execute on function request_job_payout(uuid) from anon;
grant execute on function request_job_payout(uuid) to authenticated;
