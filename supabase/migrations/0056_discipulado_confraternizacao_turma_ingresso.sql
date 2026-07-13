-- Discipulado: turma de ingresso definida na confraternizacao (manha/tarde).

alter table public.ccm_discipleship_cases
  add column if not exists confraternizacao_turma text null
  check (confraternizacao_turma in ('MANHA', 'TARDE'));

create index if not exists ccm_discipleship_cases_confraternizacao_turma_idx
  on public.ccm_discipleship_cases (congregation_id, confraternizacao_id, confraternizacao_turma);
