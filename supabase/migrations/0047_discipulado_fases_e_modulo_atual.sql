-- Discipulado: fases do case, turno de origem e modulo atual.
-- Mudanca aditiva e retrocompativel.

alter table public.discipleship_cases
  add column if not exists fase text,
  add column if not exists turno_origem text,
  add column if not exists modulo_atual_id uuid references public.discipleship_modules(id) on delete set null;

update public.discipleship_cases
set fase = coalesce(fase, 'ACOLHIMENTO');

alter table public.discipleship_cases
  alter column fase set default 'ACOLHIMENTO',
  alter column fase set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discipleship_cases_fase_check'
      and conrelid = 'public.discipleship_cases'::regclass
  ) then
    alter table public.discipleship_cases
      add constraint discipleship_cases_fase_check
      check (fase in ('ACOLHIMENTO', 'DISCIPULADO', 'POS_DISCIPULADO'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discipleship_cases_turno_origem_check'
      and conrelid = 'public.discipleship_cases'::regclass
  ) then
    alter table public.discipleship_cases
      add constraint discipleship_cases_turno_origem_check
      check (turno_origem in ('MANHA', 'NOITE', 'EVENTO') or turno_origem is null);
  end if;
end
$$;

create index if not exists discipleship_cases_fase_idx
  on public.discipleship_cases (congregation_id, fase, updated_at desc);

create index if not exists discipleship_cases_turno_origem_idx
  on public.discipleship_cases (congregation_id, turno_origem, updated_at desc);

create index if not exists discipleship_cases_modulo_atual_idx
  on public.discipleship_cases (modulo_atual_id);

-- Backfill de fase com base no status atual.
update public.discipleship_cases
set fase = 'DISCIPULADO'
where status in ('em_discipulado', 'pausado');

update public.discipleship_cases
set fase = 'POS_DISCIPULADO'
where status = 'concluido';

update public.discipleship_cases
set fase = 'ACOLHIMENTO'
where status = 'pendente_matricula';

-- Backfill de turno_origem via origem do cadastro em pessoas.
update public.discipleship_cases dc
set turno_origem = (
  case
    when coalesce(p.origem, '') ilike '%manh%' then 'MANHA'
    when coalesce(p.origem, '') ilike '%noite%' then 'NOITE'
    when coalesce(p.origem, '') ilike '%quarta%' then 'NOITE'
    when coalesce(p.origem, '') ilike '%event%' then 'EVENTO'
    when coalesce(p.origem, '') ilike '%mj%' then 'EVENTO'
    else null
  end
)
from public.pessoas p
where p.id = dc.member_id
  and dc.turno_origem is null;

-- Backfill de modulo_atual_id para cases em DISCIPULADO.
update public.discipleship_cases dc
set modulo_atual_id = picked.module_id
from (
  select
    dc_inner.id as case_id,
    (
      select dp.module_id
      from public.discipleship_progress dp
      join public.discipleship_modules dm on dm.id = dp.module_id
      where dp.case_id = dc_inner.id
        and dm.is_active = true
      order by dm.sort_order asc, dp.updated_at desc
      limit 1
    ) as module_id
  from public.discipleship_cases dc_inner
) picked
where dc.id = picked.case_id
  and dc.fase = 'DISCIPULADO'
  and dc.modulo_atual_id is null
  and picked.module_id is not null;

update public.discipleship_cases dc
set modulo_atual_id = first_module.id
from lateral (
  select m.id
  from public.discipleship_modules m
  where m.congregation_id = dc.congregation_id
    and m.is_active = true
  order by m.sort_order asc
  limit 1
) first_module
where dc.fase = 'DISCIPULADO'
  and dc.modulo_atual_id is null;
