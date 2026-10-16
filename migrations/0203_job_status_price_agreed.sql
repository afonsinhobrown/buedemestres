-- 0203: job_status não tinha 'price_agreed' nem 'in_service', mas a app usa ambos
-- (cliente fecha o acordo; mestre/detecções filtram por 'in_service').
-- Sem estes valores, updates e filtros falhavam silenciosamente (22P02).

alter type job_status add value if not exists 'price_agreed';
alter type job_status add value if not exists 'in_service';
