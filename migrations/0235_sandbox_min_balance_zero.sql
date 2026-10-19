-- 0235: Em sandbox o saldo mínimo do mestre é 0
-- Em sandbox ninguém recarrega a carteira, por isso a exigência de saldo mínimo
-- bloquearia todos os mestres. Quando `sandbox_mode` está ativo:
--   * o mínimo considerado é 0 (master_min_balance() -> 0);
--   * a exigência fica automaticamente desativada em master_can_operate().
-- Fora do sandbox, mantém-se o valor configurado (ex.: 200 MT).
--
-- O sandbox é lido de app_settings.sandbox_mode (a mesma chave usada pela app).

create or replace function sandbox_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text::boolean from app_settings where key = 'sandbox_mode'), false)
$$;

-- Mínimo efetivo: 0 em sandbox, senão o valor configurado.
create or replace function master_min_balance()
returns numeric language sql stable security definer set search_path = public as $$
  select case when sandbox_active() then 0
              else app_setting_numeric('master_min_balance', 200) end
$$;

-- O mestre só opera se tiver saldo suficiente para cobrir uma eventual multa.
-- Em sandbox (ou com a exigência desligada) não se aplica.
create or replace function master_can_operate(p_provider uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select master_min_balance_exempt(p_provider)
      or sandbox_active()
      or not app_setting_bool('master_min_balance_enforced', true)
      or master_wallet_balance(p_provider) >= master_min_balance()
$$;

-- Permissões
revoke execute on function sandbox_active() from public, anon, authenticated;
