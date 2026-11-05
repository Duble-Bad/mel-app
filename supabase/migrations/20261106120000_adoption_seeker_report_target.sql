-- Adoção: fila de interessados (decisões do proprietário de 2026-11-05).
--
-- Só o novo valor do enum de alvos da moderação. Fica sozinho nesta migration
-- porque um valor novo de enum só pode ser usado depois do commit (cada
-- migration roda na própria transação); a 20261106122000 já o usa no registro
-- de auditoria (moderation_actions) da revisão de perfis de interessados.

alter type public.report_target add value if not exists 'adoption_seeker';
