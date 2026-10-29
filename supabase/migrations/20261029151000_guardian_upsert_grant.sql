-- Upsert (insert … on conflict do update) inclui user_id no UPDATE. A política
-- "dono altera" (with check auth.uid() = user_id) impede gravar o de outra pessoa.
grant update (user_id) on public.guardian_settings to authenticated;
