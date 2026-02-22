-- Status inicial do case passa a ser pendente até matrícula em módulo.

-- 1) Ajusta domínio de status e default.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.discipleship_cases'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.discipleship_cases drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.discipleship_cases
  alter column status set default 'pendente_matricula';

alter table public.discipleship_cases
  add constraint discipleship_cases_status_check
  check (status in ('pendente_matricula', 'em_discipulado', 'concluido', 'pausado'));

-- 2) Case ativo por membro também inclui pendente_matricula.
drop index if exists public.discipleship_cases_active_member_uidx;
create unique index if not exists discipleship_cases_active_member_uidx
  on public.discipleship_cases (member_id)
  where status in ('pendente_matricula', 'em_discipulado', 'pausado');

-- 3) Regras de transição: cases com progresso existente ficam em em_discipulado;
-- sem progresso ficam pendentes.
update public.discipleship_cases dc
set status = 'em_discipulado'
where dc.status = 'pendente_matricula'
  and exists (
    select 1
    from public.discipleship_progress dp
    where dp.case_id = dc.id
  );

update public.discipleship_cases dc
set status = 'pendente_matricula'
where dc.status = 'em_discipulado'
  and not exists (
    select 1
    from public.discipleship_progress dp
    where dp.case_id = dc.id
  );

-- 4) Não matricular automaticamente em todos os módulos ao criar case.
drop trigger if exists trg_discipleship_case_insert on public.discipleship_cases;

-- 5) Primeira matrícula promove o case para em_discipulado.
create or replace function public.promote_case_status_on_first_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discipleship_cases dc
  set status = 'em_discipulado'
  where dc.id = new.case_id
    and dc.status = 'pendente_matricula';

  return new;
end;
$$;

drop trigger if exists trg_promote_case_status_on_first_enrollment on public.discipleship_progress;
create trigger trg_promote_case_status_on_first_enrollment
after insert on public.discipleship_progress
for each row execute function public.promote_case_status_on_first_enrollment();

-- 6) Lista de membros do CCM deve considerar pendente como case ativo.
create or replace function public.list_ccm_members_for_discipleship(
  search_text text default null,
  rows_limit int default 500,
  rows_offset int default 0
)
returns table (
  member_id uuid,
  member_name text,
  member_phone text,
  created_at timestamptz,
  has_active_case boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  safe_limit int := greatest(1, least(coalesce(rows_limit, 500), 1000));
  safe_offset int := greatest(0, coalesce(rows_offset, 0));
  term text := nullif(btrim(coalesce(search_text, '')), '');
begin
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  return query
  select
    p.id as member_id,
    p.nome_completo as member_name,
    p.telefone_whatsapp as member_phone,
    p.created_at,
    exists (
      select 1
      from public.discipleship_cases dc
      where dc.member_id = p.id
        and dc.status in ('pendente_matricula', 'em_discipulado', 'pausado')
    ) as has_active_case
  from public.pessoas p
  where p.congregation_id = effective_congregation
    and (
      term is null
      or p.nome_completo ilike '%' || term || '%'
      or coalesce(p.telefone_whatsapp, '') ilike '%' || term || '%'
    )
  order by p.created_at desc nulls last, p.nome_completo
  offset safe_offset
  limit safe_limit;
end;
$$;

grant execute on function public.list_ccm_members_for_discipleship(text, int, int) to authenticated;
