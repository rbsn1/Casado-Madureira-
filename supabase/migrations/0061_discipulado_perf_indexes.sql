-- Discipulado: índices de performance para chamadas/frequência e confraternização.
-- Migração aditiva e segura.

-- 1) Otimiza recálculo de frequência por aluno (trigger da chamada).
create index if not exists discipleship_chamada_itens_aluno_idx
  on public.discipleship_chamada_itens (aluno_id);

-- 2) Otimiza lista de confirmados por confraternização (filtro + ordenação).
create index if not exists discipleship_cases_confra_confirmada_em_idx
  on public.discipleship_cases (
    confraternizacao_id,
    confraternizacao_confirmada,
    confraternizacao_confirmada_em desc
  );
