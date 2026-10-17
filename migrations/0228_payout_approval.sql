-- 0228: por omissão, os saques dos mestres exigem aprovação da equipa.
-- A funcionalidade "Pagamentos por Aprovação" no superadmin altera este valor:
--   true  -> fica pending até aprovação (worker não envia sozinho)
--   false -> o sistema envia automaticamente via PaySuite

insert into app_settings(key, value)
values ('payout_require_approval', 'true'::jsonb)
on conflict (key) do nothing;
