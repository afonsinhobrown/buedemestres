-- 0207: guardar o meio de transporte da deslocação num campo próprio.
-- Antes era gravado em jobs.cancel_reason, que é reservado para cancelamentos.
alter table jobs add column if not exists transport_mode text;
