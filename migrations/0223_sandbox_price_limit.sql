-- 0223: bloquear valores fora do intervalo do modo sandbox a nível de base de dados.
-- Protege contra clientes/apps que ignorem a validação da interface.

create or replace function trg_sandbox_price_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_active boolean;
  v_min numeric;
  v_max numeric;
begin
  select coalesce((value)::text::boolean, false) into v_active
    from app_settings where key = 'sandbox_mode';
  if not coalesce(v_active, false) then
    return new;
  end if;

  select coalesce((value)::text::numeric, 1) into v_min
    from app_settings where key = 'sandbox_min_price';
  select coalesce((value)::text::numeric, 10) into v_max
    from app_settings where key = 'sandbox_max_price';

  if new.amount < coalesce(v_min, 1) or new.amount > coalesce(v_max, 10) then
    raise exception 'sandbox_limit_exceeded: valor fora do intervalo permitido (% a %)', v_min, v_max;
  end if;

  return new;
end $$;

drop trigger if exists job_price_proposals_sandbox_limit on job_price_proposals;
create trigger job_price_proposals_sandbox_limit
  before insert or update of amount on job_price_proposals
  for each row execute function trg_sandbox_price_limit();
