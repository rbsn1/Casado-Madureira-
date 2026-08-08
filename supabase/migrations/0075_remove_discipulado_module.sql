-- Remove o módulo de Discipulado deste banco: o discipulado agora é servido
-- por um app/banco Supabase independente. Ver changes/remove-discipulado-module/
-- (proposal.md e research-notes.md) para o mapeamento completo do que é
-- exclusivo de discipulado versus o que pertence ao CCM.
--
-- Ordem: (1) remover trigger que travaria pessoa_departamento, (2) remover
-- trigger de isolamento de role, (3) remover policies de pessoas que
-- referenciam tabelas de discipulado, (4) desativar perfis com role de
-- discipulado, (5) remover funções/RPCs exclusivas, (6) remover as tabelas.
--
-- O que NÃO é tocado, de propósito: pessoas.cadastro_origem/culto_origem/
-- request_id (hoje são do CCM), public.congregations (infraestrutura
-- multi-congregação), policies em departamentos/batismos/eventos_timeline/
-- integracao_novos_convertidos que citam roles de discipulado (ficam
-- inertes, não referenciam tabela derrubada), src/lib/serverAuth.ts e as
-- rotas api/admin/users e api/admin/roles (decisão do usuário).

-- 1) Trigger que bloqueava pessoa_departamento (tabela do CCM) dependendo de
--    ccm_discipleship_cases.
drop trigger if exists trg_enforce_department_eligibility on public.pessoa_departamento;
drop function if exists public.enforce_department_eligibility();
drop function if exists public.is_member_department_eligible(uuid);

-- 2) Trigger de isolamento de role (impedia ADMIN_MASTER + ADMIN_DISCIPULADO
--    simultâneos em usuarios_perfis).
drop trigger if exists trg_enforce_discipleship_role_isolation on public.usuarios_perfis;
drop function if exists public.enforce_discipleship_role_isolation();

-- 3) Policies de pessoas que referenciam tabelas/roles de discipulado e
--    ficariam quebradas após o DROP TABLE abaixo.
drop policy if exists "pessoas_read_discipulado_bridge" on public.pessoas;
drop policy if exists "pessoas_delete_discipulado_bridge" on public.pessoas;

-- 4) Desativa (soft, sem apagar linha) qualquer perfil com role de
--    discipulado — mesmo padrão já usado na migration 0070.
update public.usuarios_perfis
set active = false
where active is true
  and role in ('DISCIPULADOR', 'SM_DISCIPULADO', 'ADMIN_DISCIPULADO', 'SECRETARIA_DISCIPULADO');

-- 5) Funções/RPCs exclusivas de discipulado.
drop function if exists public.handle_discipleship_case_insert() cascade;
drop function if exists public.sync_discipleship_progress_congregation() cascade;
drop function if exists public.enforce_discipleship_case_conclusion() cascade;
drop function if exists public.touch_case_from_progress() cascade;
drop function if exists public.get_discipleship_dashboard(integer, uuid);
drop function if exists public.ensure_discipleship_case_has_active_modules() cascade;
drop function if exists public.is_negative_contact_outcome(text);
drop function if exists public.classify_discipleship_criticality(uuid);
drop function if exists public.refresh_discipleship_case_criticality(uuid);
drop function if exists public.refresh_discipleship_case_criticality_daily();
drop function if exists public.sync_contact_attempt_context() cascade;
drop function if exists public.handle_contact_attempt_change() cascade;
drop function if exists public.handle_discipleship_calendar_change() cascade;
drop function if exists public.handle_discipleship_case_criticality_init() cascade;
drop function if exists public.search_ccm_members_for_discipleship(text);
drop function if exists public.list_ccm_discipleship_cases_summary(uuid);
drop function if exists public.get_discipleship_without_case_snapshot(uuid);
drop function if exists public.list_ccm_members_for_discipleship(uuid);
drop function if exists public.create_ccm_member_from_discipleship(jsonb);
drop function if exists public.update_ccm_member_profile_from_discipleship(uuid, jsonb);
drop function if exists public.promote_case_status_on_first_enrollment() cascade;
drop function if exists public.derive_confraternizacao_status(uuid);
drop function if exists public.apply_confraternizacao_status() cascade;
drop function if exists public.sync_confraternizacao_from_calendar() cascade;
drop function if exists public.get_active_confraternizacao(uuid);
drop function if exists public.refresh_discipleship_case_attendance(uuid);
drop function if exists public.handle_discipleship_case_attendance_from_chamada() cascade;
drop function if exists public.log_discipleship_chamada_timeline() cascade;
drop function if exists public.is_discipulado_user();

-- 6) Tabelas exclusivas de discipulado. CASCADE cobre a ordem de dependência
--    entre elas (FKs cruzadas de cases/progress/turmas/aulas/chamada).
drop table if exists public.discipleship_case_events cascade;
drop table if exists public.discipleship_chamada_itens cascade;
drop table if exists public.discipleship_aulas cascade;
drop table if exists public.discipleship_turma_alunos cascade;
drop table if exists public.ccm_contact_attempts cascade;
drop table if exists public.discipleship_progress cascade;
drop table if exists public.discipleship_calendar cascade;
drop table if exists public.confraternizacoes cascade;
drop table if exists public.discipleship_turma_settings cascade;
drop table if exists public.discipleship_turmas cascade;
drop table if exists public.discipleship_modules cascade;
drop table if exists public.ccm_discipleship_cases cascade;
