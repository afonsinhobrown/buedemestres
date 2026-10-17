-- 0225: activar Realtime nas tabelas usadas pelo chat e pelo fluxo de trabalho.
-- Sem isto, as subscrições postgres_changes em messages/jobs/etc. nunca
-- recebem eventos e as apps ficam dependentes apenas do polling.

do $$
declare
  t text;
begin
  foreach t in array array[
    'jobs',
    'job_price_proposals',
    'job_payments',
    'job_addenda',
    'conversations',
    'messages',
    'notifications'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
