-- 0202: Ciclo de vida da negociação
-- Objectivo: acabar com estados "meio-mortos" (ex.: puxado eterno).
--   * Um dono por turno (cliente ou mestre) com prazo por turno.
--   * Tempos configuráveis por urgência (sos/today = 10 min, scheduled = 24 h).
--   * Expiração automática: quem falha perde; o pedido reabre para o pool.
--   * Limite de rondas para travar o "testar preços".

-- 1. Configuração flexível dos tempos (por urgência) -------------------------
create table if not exists negotiation_settings (
  urgency urgency_level primary key,
  turn_timeout_minutes int not null check (turn_timeout_minutes > 0),
  max_rounds smallint not null default 3 check (max_rounds > 0),
  updated_at timestamptz not null default now()
);

insert into negotiation_settings (urgency, turn_timeout_minutes, max_rounds) values
  ('sos',       10,   3),
  ('today',     10,   3),
  ('scheduled', 1440, 3)
on conflict (urgency) do nothing;

-- 2. Metadados de negociação no job ------------------------------------------
alter table jobs
  add column if not exists negotiation_state text,
  add column if not exists turn_owner text,
  add column if not exists turn_expires_at timestamptz,
  add column if not exists negotiation_rounds smallint not null default 0,
  add column if not exists last_activity_at timestamptz default now();

create index if not exists jobs_turn_expiry_idx
  on jobs (turn_expires_at) where turn_expires_at is not null;

-- 3. Helpers de configuração -------------------------------------------------
create or replace function negotiation_timeout_minutes(p_job uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(ns.turn_timeout_minutes, 10)
  from jobs j
  left join service_requests r on r.id = j.request_id
  left join negotiation_settings ns on ns.urgency = r.urgency
  where j.id = p_job
$$;

create or replace function negotiation_max_rounds(p_job uuid)
returns smallint language sql stable security definer set search_path = public as $$
  select coalesce(ns.max_rounds, 3)
  from jobs j
  left join service_requests r on r.id = j.request_id
  left join negotiation_settings ns on ns.urgency = r.urgency
  where j.id = p_job
$$;

-- 4. Definir de quem é o turno (reinicia o relógio) --------------------------
create or replace function set_negotiation_turn(
  p_job uuid,
  p_owner text,
  p_is_counter boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
declare v_rounds smallint; v_max smallint;
begin
  if p_owner not in ('client','provider') then
    raise exception 'invalid_owner';
  end if;

  if p_is_counter then
    select negotiation_rounds, negotiation_max_rounds(p_job)
      into v_rounds, v_max
      from jobs where id = p_job;
    if coalesce(v_rounds, 0) >= coalesce(v_max, 3) then
      raise exception 'max_rounds_reached';
    end if;
  end if;

  update jobs
     set turn_owner = p_owner,
         turn_expires_at = now() + make_interval(mins => negotiation_timeout_minutes(id)),
         negotiation_state = case p_owner
                               when 'client' then 'aguardando_cliente'
                               else 'aguardando_mestre' end,
         negotiation_rounds = negotiation_rounds + case when p_is_counter then 1 else 0 end,
         last_activity_at = now(),
         updated_at = now()
   where id = p_job;
end $$;

-- 5. Fechar acordo -----------------------------------------------------------
create or replace function close_negotiation(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update jobs
     set negotiation_state = 'acordado',
         turn_owner = null,
         turn_expires_at = null,
         last_activity_at = now(),
         updated_at = now()
   where id = p_job;
end $$;

-- 6. Expirar turnos vencidos -------------------------------------------------
create or replace function expire_stale_negotiations()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_j jobs;
  v_owner text;
  v_count int := 0;
begin
  for v_j in
    select * from jobs
     where turn_expires_at is not null
       and turn_expires_at < now()
       and status in ('accepted','price_proposed','puxado')
     for update skip locked
  loop
    v_owner := v_j.turn_owner;

    -- retirar propostas ainda pendentes
    update job_price_proposals set status = 'withdrawn'
     where job_id = v_j.id and status = 'pending';

    -- fechar o trabalho com estado terminal explícito
    update jobs
       set status = 'cancelled',
           cancel_reason = case v_owner when 'provider' then 'expirado_mestre'
                                        else 'expirado_cliente' end,
           negotiation_state = case v_owner when 'provider' then 'expirado_mestre'
                                            else 'expirado_cliente' end,
           turn_owner = null,
           turn_expires_at = null,
           updated_at = now()
     where id = v_j.id;

    -- reabrir o pedido para o pool (≠ deixar retido)
    update service_requests
       set status = 'open',
           target_provider_id = null,
           updated_at = now()
     where id = v_j.request_id
       and status in ('accepted','price_proposed','puxado');

    -- libertar o mestre
    update provider_presence set active_job_id = null where active_job_id = v_j.id;

    -- notificar quem deixou passar
    insert into notifications(profile_id, type, title, body, data)
    values (
      case when v_owner = 'provider' then v_j.provider_id else v_j.client_id end,
      'negotiation_expired',
      'Negociação expirada',
      case when v_owner = 'provider'
           then 'O profissional não respondeu a tempo. O pedido foi reaberto para outros profissionais.'
           else 'Não respondeste a tempo. O pedido foi reaberto e pode ser aceite por outro profissional.' end,
      jsonb_build_object('job_id', v_j.id, 'request_id', v_j.request_id, 'failed_owner', v_owner)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- 7. Backfill: dar prazo a jobs legados sem metadados ------------------------
update jobs
   set turn_owner = case when status = 'puxado' then 'provider' else 'client' end,
       turn_expires_at = coalesce(updated_at, now())
                         + make_interval(mins => negotiation_timeout_minutes(id)),
       negotiation_state = case when status = 'puxado' then 'aguardando_mestre'
                                else 'aguardando_cliente' end,
       last_activity_at = coalesce(updated_at, now())
 where turn_expires_at is null
   and status in ('puxado','price_proposed');

-- 8. Agendar varredura (se pg_cron existir) ----------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('negotiations-expire', '*/1 * * * *',
      $cron$select expire_stale_negotiations();$cron$);
  end if;
exception when others then
  raise notice 'pg_cron indisponível, varredura será feita pela app: %', sqlerrm;
end $$;
