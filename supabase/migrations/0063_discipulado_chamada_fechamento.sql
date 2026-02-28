-- Discipulado: permite fechar/reabrir uma chamada de aula.

alter table public.discipleship_aulas
  add column if not exists fechada boolean not null default false,
  add column if not exists fechada_em timestamptz null,
  add column if not exists fechada_por uuid null references auth.users(id) on delete set null;

create index if not exists discipleship_aulas_fechada_idx
  on public.discipleship_aulas (turma_id, data desc, fechada);
