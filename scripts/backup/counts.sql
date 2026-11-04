-- Linhas por tabela (public, auth, storage) para conferir uma restauração.
-- Fica de fora o que é do próprio Supabase e muda entre versões (migrations
-- internas) ou cresce sozinho (log de auditoria do Auth).
select n.nspname || '.' || c.relname,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p')
   and n.nspname in ('public', 'auth', 'storage')
   and c.relname not in ('schema_migrations', 'migrations', 'audit_log_entries')
 order by 1;
