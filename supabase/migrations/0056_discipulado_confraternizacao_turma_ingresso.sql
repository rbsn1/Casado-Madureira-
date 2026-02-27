-- Discipulado: turma de ingresso definida na confraternizacao (manha/tarde).

alter table public.discipleship_cases
  add column if not exists confraternizacao_turma text null
  check (confraternizacao_turma in ('MANHA', 'TARDE'));

create index if not exists discipleship_cases_confraternizacao_turma_idx
  on public.discipleship_cases (congregation_id, confraternizacao_id, confraternizacao_turma);
