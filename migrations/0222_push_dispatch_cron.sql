-- 0222: disparo automático de notificações push (pg_cron + pg_net)
-- A configuração (URL do endpoint e segredo) vive em app_settings.key = 'push_dispatch'.
-- Se não existir configuração, a função não faz nada.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function dispatch_push_notifications()
returns void language plpgsql security definer set search_path = public, net as $$
declare
  v_cfg jsonb;
begin
  select value into v_cfg from app_settings where key = 'push_dispatch';
  if v_cfg is null
     or coalesce(v_cfg->>'url', '') = ''
     or coalesce(v_cfg->>'secret', '') = '' then
    return;
  end if;

  perform net.http_post(
    url := v_cfg->>'url',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_cfg->>'secret'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end $$;

select cron.unschedule('push-dispatch')
where exists (select 1 from cron.job where jobname = 'push-dispatch');

select cron.schedule('push-dispatch', '* * * * *', $$select dispatch_push_notifications()$$);
