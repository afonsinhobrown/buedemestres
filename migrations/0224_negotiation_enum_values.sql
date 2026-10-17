-- 0224: garantir os valores de enum usados pelo fluxo de negociação.
-- Estes valores já eram escritos pelo código (service_requests.status e
-- jobs.status), mas faltavam nas migrações versionadas. Sem eles, os updates
-- falhavam com 22P02 e o orçamento nunca chegava ao cliente.

alter type request_status add value if not exists 'price_proposed';
alter type request_status add value if not exists 'puxado';

alter type job_status add value if not exists 'price_agreed';
alter type job_status add value if not exists 'in_service';
alter type job_status add value if not exists 'puxado';
