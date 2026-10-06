-- Remove a funcionalidade de agenda semanal e o painel de evento especial.
-- Proposta: changes/remove-agenda-semanal/proposal.md
--
-- Sem CASCADE de propósito: se algum objeto do banco ainda depender da tabela,
-- a migration falha e faz rollback em vez de derrubar o dependente.

drop table if exists public.weekly_schedule_events;

delete from public.app_settings where key = 'special_event';
