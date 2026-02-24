-- Discipulado: data de inicio por modulo no progresso do case.

alter table public.discipleship_progress
  add column if not exists start_date date null;

create index if not exists discipleship_progress_case_start_date_idx
  on public.discipleship_progress (case_id, start_date);

-- Backfill inicial: usa a data de criacao do progresso para modulos que ja foram iniciados/finalizados.
update public.discipleship_progress
set start_date = (created_at at time zone 'America/Manaus')::date
where start_date is null
  and status in ('em_andamento', 'concluido');

