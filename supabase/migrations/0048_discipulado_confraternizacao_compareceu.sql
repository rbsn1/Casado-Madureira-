-- Registra comparecimento real na confraternizacao para cases confirmados.

alter table public.discipleship_cases
  add column if not exists confraternizacao_compareceu boolean not null default false,
  add column if not exists confraternizacao_compareceu_em timestamptz null;

create index if not exists discipleship_cases_confraternizacao_compareceu_idx
  on public.discipleship_cases (congregation_id, confraternizacao_id, confraternizacao_compareceu);
