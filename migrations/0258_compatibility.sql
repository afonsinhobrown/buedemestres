-- 0258: compatibilidade e defaults do fluxo antigo
-- Nenhuma tabela é removida. As apps v1 continuam a ler as tabelas originais.

alter table job_addenda alter column kind set default 'extra';
alter table job_refunds alter column source set default 'service';

update jobs
   set job_phase = status::text
 where job_phase is null;

update job_payments
   set labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0)
 where labor_amount is null or parts_amount is null;

update job_addenda
   set kind = coalesce(kind, 'extra'),
       labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0)
 where kind is null or labor_amount is null or parts_amount is null;

update job_price_proposals
   set labor_amount = coalesce(labor_amount, amount),
       parts_amount = coalesce(parts_amount, 0)
 where labor_amount is null or parts_amount is null;

update job_refunds
   set source = coalesce(source, 'service')
 where source is null;

-- Views de leitura para código novo que queira isolar o serviço dos encargos.
create or replace view v_job_payments_service as
  select * from job_payments;

create or replace view v_job_addenda_extra as
  select * from job_addenda where kind = 'extra';
