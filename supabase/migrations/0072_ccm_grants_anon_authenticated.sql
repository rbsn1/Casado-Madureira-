-- Garante privilégios de tabela para anon/authenticated nas tabelas do CCM.
-- Esse projeto compartilha o schema public com outro sistema (módulo de
-- discipulado independente), então os grants abaixo listam explicitamente
-- só as tabelas do CCM, sem tocar nas tabelas do outro sistema.
-- RLS continua sendo a barreira real de acesso por linha; isso só garante
-- que a camada de GRANT não bloqueie antes mesmo da RLS ser avaliada.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.app_settings,
  public.batismos,
  public.ccm_cadastros_historico_mensal,
  public.ccm_contact_attempts,
  public.ccm_discipleship_cases,
  public.church_settings,
  public.confraternizacoes,
  public.congregations,
  public.departamentos,
  public.departamentos_publicos,
  public.department_contacts,
  public.department_faq,
  public.department_roles,
  public.departments,
  public.discipleship_aulas,
  public.discipleship_calendar,
  public.discipleship_case_events,
  public.discipleship_chamada_itens,
  public.discipleship_modules,
  public.discipleship_progress,
  public.discipleship_turma_alunos,
  public.discipleship_turmas,
  public.discipleship_turma_settings,
  public.escalas_domingo,
  public.escalas_domingo_usuarios,
  public.eventos_timeline,
  public.integracao_novos_convertidos,
  public.member_profile_completion_links,
  public.message_jobs,
  public.pessoa_departamento,
  public.pessoas,
  public.user_contacts,
  public.usuarios_perfis,
  public.weekly_schedule_events
to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
