-- Complementa 0075: durante a verificação pós-aplicação foram encontrados
-- três grupos de objetos que a migration anterior não cobriu.
--
-- Grupo A: funções-ponte do módulo antigo (CCM <-> discipulado) que sobraram
-- porque 0075 tentou derrubá-las com assinaturas erradas.
--
-- Grupo B: um rascunho vazio (0 linhas em todas as tabelas) do app
-- independente de discipulado (spec em docs/discipulado-modulo-independente.md),
-- criado direto no banco sem nenhuma migration correspondente neste repo.
-- Confirmado com o usuário: rascunho abandonado, seguro de remover.
--
-- Grupo C: quatro policies da tabela compartilhada `congregations` (delete,
-- insert, select, update) que dependiam da autenticação do rascunho
-- (profiles/user_role) e por isso são hoje inalcançáveis (profiles está
-- vazia). Confirmado com o usuário que podem ser removidas: o acesso real
-- do CCM a `congregations` continua garantido por `congregations_read`
-- (SELECT) e `congregations_manage_admin` (ALL, para is_admin_master()).

-- Grupo A: funções-ponte remanescentes do módulo antigo.
drop function if exists public.create_ccm_member_from_discipleship(
  full_name text, phone_whatsapp text, origin text, origin_church text,
  neighborhood text, notes text
);
drop function if exists public.update_ccm_member_profile_from_discipleship(
  target_member_id uuid, full_name text, phone_whatsapp text, origin text,
  origin_church text, neighborhood text, notes text
);
drop function if exists public.search_ccm_members_for_discipleship(
  search_text text, rows_limit integer, target_congregation_id uuid
);
drop function if exists public.list_ccm_members_for_discipleship(
  search_text text, rows_limit integer, rows_offset integer
);
drop function if exists public.list_ccm_discipleship_cases_summary(
  status_filter text, target_congregation_id uuid, rows_limit integer
);
drop function if exists public.get_discipleship_without_case_snapshot(
  target_congregation_id uuid, rows_limit integer
);

-- Grupo B: RPCs do rascunho do app independente.
drop function if exists public.create_discipleship_case(
  p_disciple_id uuid, p_congregation_id uuid, p_assigned_to uuid,
  p_welcomed_on date, p_notes text, p_created_by uuid
);
drop function if exists public.enroll_disciple(
  p_disciple_id uuid, p_class_id uuid, p_case_id uuid, p_created_by uuid
);
drop function if exists public.unenroll_disciple(
  p_disciple_id uuid, p_case_id uuid, p_created_by uuid
);
drop function if exists public.start_post_discipleship(p_case_id uuid, p_created_by uuid);
drop function if exists public.classify_discipleship_criticality(
  target_days_to_confra integer, target_negative_count integer
);
drop function if exists public.refresh_discipleship_case_attendance(
  target_case_id uuid, target_member_id uuid
);
drop function if exists public.refresh_discipleship_case_criticality(
  target_congregation_id uuid, target_case_id uuid
);

-- Grupo B + C: funções de autenticação do rascunho. CASCADE aqui remove,
-- além das ~26 policies internas do rascunho, as 4 policies de
-- `congregations` do Grupo C (select/insert/update/delete), já confirmadas
-- inalcançáveis e aprovadas para remoção.
drop function if exists public.is_platform_admin() cascade;
drop function if exists public.auth_congregation_id() cascade;
drop function if exists public.auth_role() cascade;
drop function if exists public.auth_profile() cascade;
drop function if exists public.has_role(user_role[]) cascade;

-- Grupo B: tabelas do rascunho (CASCADE remove FKs cruzadas, triggers e
-- índices; as policies já foram removidas acima junto com as funções).
drop table if exists public.case_events cascade;
drop table if exists public.attendance_items cascade;
drop table if exists public.lessons cascade;
drop table if exists public.event_confirmations cascade;
drop table if exists public.events cascade;
drop table if exists public.contact_attempts cascade;
drop table if exists public.post_discipleship cascade;
drop table if exists public.case_module_progress cascade;
drop table if exists public.class_enrollments cascade;
drop table if exists public.classes cascade;
drop table if exists public.discipleship_cases cascade;
drop table if exists public.module_templates cascade;
drop table if exists public.disciples cascade;
drop table if exists public.profiles cascade;

-- Grupo B: enums exclusivos das tabelas do rascunho, agora sem nenhuma
-- coluna/função dependente (confirmado: nenhuma outra coluna no banco usa
-- esses tipos).
drop type if exists public.user_role;
drop type if exists public.attendance_status;
drop type if exists public.case_event_type;
drop type if exists public.module_progress_status;
drop type if exists public.class_shift;
drop type if exists public.contact_outcome;
drop type if exists public.case_status;
drop type if exists public.case_stage;
drop type if exists public.event_type;
drop type if exists public.event_status;
drop type if exists public.integration_status;
drop type if exists public.baptism_status;
