-- 0252: fixar valor de sandbox para 11 MT em todos os pagamentos e triggers
-- PaySuite e operadoras exigem valores acima do limiar mínimo.

insert into app_settings (key, value, updated_at)
values
  ('sandbox_min_price', '11'::jsonb, now()),
  ('sandbox_max_price', '11'::jsonb, now())
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

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

  select coalesce((value)::text::numeric, 11) into v_min
    from app_settings where key = 'sandbox_min_price';
  select coalesce((value)::text::numeric, 11) into v_max
    from app_settings where key = 'sandbox_max_price';

  if new.amount < coalesce(v_min, 11) or new.amount > coalesce(v_max, 11) then
    raise exception 'sandbox_limit_exceeded: valor fora do intervalo permitido (% a %)', v_min, v_max;
  end if;

  return new;
end $$;
