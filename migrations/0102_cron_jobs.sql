-- 4.7 Jobs agendados (pg_cron)
-- Requer a extensão pg_cron activa na base de dados Neon/Supabase

-- marcar SLA falhado (de 5 em 5 minutos)
select cron.schedule('tickets-sla','*/5 * * * *', $$
  update tickets set sla_breached = true
  where not sla_breached and status in ('open','in_progress','waiting_customer')
    and ((first_response_at is null and first_response_due < now()) or resolution_due < now());
  insert into ticket_events(ticket_id, actor_id, type)
    select id, null, 'sla_breached' from tickets t where sla_breached
    and not exists (select 1 from ticket_events e where e.ticket_id=t.id and e.type='sla_breached');
$$);

-- fechar tickets resolvidos sem resposta há 5 dias (diário)
select cron.schedule('tickets-autoclose','0 2 * * *', $$
  update tickets set status='closed', closed_at=now()
  where status='resolved' and resolved_at < now() - interval '5 days'
$$);

-- expirar aprovações pendentes
select cron.schedule('approvals-expire','*/30 * * * *', $$
  update approval_requests set status='expired' where status='pending' and expires_at < now()
$$);
