-- 0243: um mestre só pode estar online/activo num dispositivo de cada vez
-- O cliente envia um device_id estável (gerado e guardado no dispositivo) ao
-- ficar online. A presença fica "reservada" a esse dispositivo enquanto o
-- heartbeat for recente (2 minutos). Outro dispositivo recebe false e não fica
-- online. Se o dispositivo antigo morrer, a reserva expira e o novo pode entrar.

alter table provider_presence
  add column if not exists device_id text;

create or replace function provider_claim_device(
  p_provider uuid,
  p_device_id text,
  p_categories int[] default null
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_presence provider_presence;
  v_uid uuid := auth.uid();
begin
  if v_uid is not null and v_uid <> p_provider then
    raise exception 'forbidden';
  end if;

  if p_provider is null or p_device_id is null or length(btrim(p_device_id)) = 0 then
    raise exception 'invalid_device';
  end if;

  -- Serializa claims concorrentes (incluindo quando ainda não existe linha).
  perform pg_advisory_xact_lock(hashtext('provider_device:' || p_provider::text)::bigint);

  select * into v_presence
    from provider_presence
   where provider_id = p_provider
   for update;

  if found then
    if v_presence.device_id is not null
       and v_presence.device_id <> p_device_id
       and v_presence.updated_at > now() - interval '2 minutes' then
      return false;
    end if;

    update provider_presence
       set device_id = p_device_id,
           is_online = true,
           categories = coalesce(p_categories, categories),
           updated_at = now()
     where provider_id = p_provider;
  else
    insert into provider_presence(provider_id, is_online, categories, device_id, updated_at)
    values (p_provider, true, coalesce(p_categories, '{}'::int[]), p_device_id, now());
  end if;

  return true;
end $$;

create or replace function provider_release_device(
  p_provider uuid,
  p_device_id text
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is not null and v_uid <> p_provider then
    raise exception 'forbidden';
  end if;

  perform pg_advisory_xact_lock(hashtext('provider_device:' || p_provider::text)::bigint);

  update provider_presence
     set is_online = false,
         device_id = null,
         updated_at = now()
   where provider_id = p_provider
     and device_id = p_device_id;

  return found;
end $$;

revoke execute on function provider_claim_device(uuid, text, int[]) from public, anon;
revoke execute on function provider_release_device(uuid, text) from public, anon;
grant execute on function provider_claim_device(uuid, text, int[]) to authenticated;
grant execute on function provider_release_device(uuid, text) to authenticated;
