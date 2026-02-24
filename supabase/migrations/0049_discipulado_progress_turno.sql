-- Discipulado: turno por modulo (matricula/progresso).
-- Cada registro em discipleship_progress pode ter seu proprio turno.

alter table public.discipleship_progress
  add column if not exists turno text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discipleship_progress_turno_check'
      and conrelid = 'public.discipleship_progress'::regclass
  ) then
    alter table public.discipleship_progress
      add constraint discipleship_progress_turno_check
      check (turno in ('MANHA', 'NOITE', 'EVENTO') or turno is null);
  end if;
end
$$;

create index if not exists discipleship_progress_case_turno_idx
  on public.discipleship_progress (case_id, turno);

-- Backfill inicial com o turno atual do case.
update public.discipleship_progress dp
set turno = dc.turno_origem
from public.discipleship_cases dc
where dc.id = dp.case_id
  and dp.turno is null
  and dc.turno_origem in ('MANHA', 'NOITE', 'EVENTO');
