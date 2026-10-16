-- 0204: Anti-abuso — limite de negociações activas e reputação/cooldown
-- Objectivo: travar o "testar preços" e o abandono repetido.

-- 1. Configuração global flexível (key/value) --------------------------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings(key, value) values
  ('max_active_requests_per_client', '2'::jsonb),
  ('abandon_window_hours', '24'::jsonb),
  ('abandon_threshold', '3'::jsonb),
  ('abandon_cooldown_minutes', '30'::jsonb)
on conflict (key) do nothing;

create or replace function app_setting_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text::int from app_settings where key = p_key), p_default)
$$;

-- 2. Estatísticas de fiabilidade por utilizador -------------------------------
create table if not exists reliability_stats (
  profile_id uuid primary key references profiles(id) on delete cascade,
  role user_role not null default 'client',
  abandon_count int not null default 0,
  last_abandon_at timestamptz,
  cooldown_until timestamptz,
  updated_at timestamptz not null default now()
);

-- 3. Registar abandono (expiração por falta de resposta) ----------------------
create or replace function register_abandon(p_profile uuid, p_role user_role)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_window interval := make_interval(hours => app_setting_int('abandon_window_hours', 24));
  v_threshold int := app_setting_int('abandon_threshold', 3);
  v_cooldown interval := make_interval(mins => app_setting_int('abandon_cooldown_minutes', 30));
  v_count int;
  v_last timestamptz;
begin
  select abandon_count, last_abandon_at into v_count, v_last
    from reliability_stats where profile_id = p_profile for update;

  if not found then
    insert into reliability_stats(profile_id, role, abandon_count, last_abandon_at)
    values (p_profile, p_role, 1, now())
    on conflict (profile_id) do update
      set abandon_count = reliability_stats.abandon_count + 1,
          last_abandon_at = now(),
          role = excluded.role,
          updated_at = now();
    return;
  end if;

  -- fora da janela => reinicia a contagem
  if v_last is null or v_last < now() - v_window then
    v_count := 0;
  end if;

  update reliability_stats
     set role = p_role,
         abandon_count = v_count + 1,
         last_abandon_at = now(),
         cooldown_until = case when v_count + 1 >= v_threshold
                               then now() + v_cooldown else cooldown_until end,
         updated_at = now()
   where profile_id = p_profile;
end $$;

create or replace function profile_on_cooldown(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reliability_stats
     where profile_id = p_profile and cooldown_until is not null and cooldown_until > now()
  )
$$;

-- 4. Capacidade do cliente ----------------------------------------------------
-- Só contam os pedidos que estão À PROCURA de mestre (abertos/em negociação).
-- Pedidos já atribuídos a um mestre (accepted/price_proposed/puxado) não contam:
-- aí já não há "testar preços", há um trabalho comprometido.
create or replace function client_active_request_count(p_client uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from service_requests
   where client_id = p_client
     and status in ('open','in_negotiation')
$$;

create or replace function client_can_open_request(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (not profile_on_cooldown(p_client))
     and client_active_request_count(p_client) < app_setting_int('max_active_requests_per_client', 2)
$$;

create or replace function provider_can_accept(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not profile_on_cooldown(p_provider)
$$;

-- 5. Trigger: bloqueia abertura de pedidos acima do limite (só on-demand) -----
create or replace function trg_service_requests_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.mode = 'on_demand' and new.client_id is not null
     and not client_can_open_request(new.client_id) then
    raise exception 'client_rate_limited';
  end if;
  return new;
end $$;

drop trigger if exists service_requests_rate_limit on service_requests;
create trigger service_requests_rate_limit
  before insert on service_requests
  for each row execute function trg_service_requests_rate_limit();

-- 6. Expiração passa a registar reputação -------------------------------------
create or replace function expire_stale_negotiations()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_j jobs;
  v_owner text;
  v_count int := 0;
  v_failed uuid;
  v_on_cooldown boolean;
begin
  for v_j in
    select * from jobs
     where turn_expires_at is not null
       and turn_expires_at < now()
       and status in ('accepted','price_proposed','puxado')
     for update skip locked
  loop
    v_owner := v_j.turn_owner;
    v_failed := case when v_owner = 'provider' then v_j.provider_id else v_j.client_id end;
    v_on_cooldown := false;

    -- reputação: registar o abandono
    begin
      perform register_abandon(
        v_failed,
        case when v_owner = 'provider' then 'provider'::user_role else 'client'::user_role end
      );
      v_on_cooldown := profile_on_cooldown(v_failed);
    exception when others then
      null;
    end;

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

    -- reabrir o pedido para o pool
    update service_requests
       set status = 'open',
           target_provider_id = null,
           updated_at = now()
     where id = v_j.request_id
       and status in ('accepted','price_proposed','puxado');

    -- libertar o mestre
    update provider_presence set active_job_id = null where active_job_id = v_j.id;

    -- notificar quem deixou passar (com aviso de cooldown, se aplicável)
    insert into notifications(profile_id, type, title, body, data)
    values (
      v_failed,
      'negotiation_expired',
      'Negociação expirada',
      case
        when v_owner = 'provider' then
          case when v_on_cooldown
               then 'Não respondeste a tempo. Ficaste temporariamente suspenso de aceitar novos pedidos.'
               else 'O profissional não respondeu a tempo. O pedido foi reaberto para outros profissionais.' end
        else
          case when v_on_cooldown
               then 'Não respondeste a tempo e atingiste o limite de faltas. Ficaste temporariamente impedido de abrir novos pedidos.'
               else 'Não respondeste a tempo. O pedido foi reaberto e pode ser aceite por outro profissional.' end
      end,
      jsonb_build_object('job_id', v_j.id, 'request_id', v_j.request_id,
                         'failed_owner', v_owner, 'cooldown', v_on_cooldown)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
