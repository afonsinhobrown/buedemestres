-- 0230: garantir que service_requests também está publicada no Realtime.
-- As apps cliente/mestre dependem de postgres_changes nesta tabela para
-- receber novos pedidos e mudanças de estado. A migração 0225 não a incluía.

do $$
declare
  t text;
begin
  foreach t in array array[
    'service_requests',
    'jobs',
    'job_payments',
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
