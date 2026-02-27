-- Discipulado: historico por case + registro automatico de chamada.

create table if not exists public.discipleship_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipleship_cases(id) on delete cascade,
  member_id uuid not null references public.pessoas(id) on delete cascade,
  congregation_id uuid not null references public.congregations(id) on delete restrict,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discipleship_case_events_case_created_idx
  on public.discipleship_case_events (case_id, created_at desc);

create index if not exists discipleship_case_events_member_created_idx
  on public.discipleship_case_events (member_id, created_at desc);

create index if not exists discipleship_case_events_congregation_created_idx
  on public.discipleship_case_events (congregation_id, created_at desc);

drop trigger if exists trg_touch_discipleship_case_events on public.discipleship_case_events;
create trigger trg_touch_discipleship_case_events
before update on public.discipleship_case_events
for each row execute function public.touch_updated_at();

alter table public.discipleship_case_events enable row level security;

drop policy if exists "discipleship_case_events_read" on public.discipleship_case_events;
create policy "discipleship_case_events_read" on public.discipleship_case_events
for select
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
);

drop policy if exists "discipleship_case_events_manage" on public.discipleship_case_events;
create policy "discipleship_case_events_manage" on public.discipleship_case_events
for all
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
)
with check (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
);

grant select, insert, update, delete on public.discipleship_case_events to authenticated;

create or replace function public.log_discipleship_chamada_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aula_data date;
  aula_tema text;
  turma_id_value uuid;
  turma_nome text;
  turma_turno text;
  descricao_evento text;
  status_anterior text;
  target_case_id uuid;
  target_case_congregation uuid;
begin
  if new.status is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select
    a.data,
    a.tema,
    a.turma_id,
    t.nome,
    t.turno
  into
    aula_data,
    aula_tema,
    turma_id_value,
    turma_nome,
    turma_turno
  from public.discipleship_aulas a
  join public.discipleship_turmas t on t.id = a.turma_id
  where a.id = new.aula_id;

  if turma_id_value is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not null then
    status_anterior := old.status;
    descricao_evento := format(
      'Chamada atualizada (%s): %s -> %s',
      to_char(aula_data, 'DD/MM/YYYY'),
      old.status,
      new.status
    );
  else
    descricao_evento := format(
      'Chamada registrada (%s): %s',
      to_char(aula_data, 'DD/MM/YYYY'),
      new.status
    );
  end if;

  perform public.log_timeline(
    new.aluno_id,
    'CHAMADA',
    descricao_evento,
    jsonb_build_object(
      'origem', 'discipulado_chamada',
      'aula_id', new.aula_id,
      'turma_id', turma_id_value,
      'turma_nome', turma_nome,
      'turma_turno', turma_turno,
      'data_aula', aula_data,
      'tema', aula_tema,
      'status', new.status,
      'status_anterior', status_anterior,
      'observacao', new.observacao
    )
  );

  select
    dc.id,
    dc.congregation_id
  into
    target_case_id,
    target_case_congregation
  from public.discipleship_cases dc
  where dc.member_id = new.aluno_id
  order by
    case
      when dc.status in ('pendente_matricula', 'em_discipulado', 'pausado') then 0
      else 1
    end asc,
    dc.updated_at desc
  limit 1;

  if target_case_id is not null then
    insert into public.discipleship_case_events (
      case_id,
      member_id,
      congregation_id,
      event_type,
      description,
      metadata,
      created_by
    )
    values (
      target_case_id,
      new.aluno_id,
      target_case_congregation,
      'CHAMADA',
      descricao_evento,
      jsonb_build_object(
        'origem', 'discipulado_chamada',
        'aula_id', new.aula_id,
        'turma_id', turma_id_value,
        'turma_nome', turma_nome,
        'turma_turno', turma_turno,
        'data_aula', aula_data,
        'tema', aula_tema,
        'status', new.status,
        'status_anterior', status_anterior,
        'observacao', new.observacao
      ),
      coalesce(new.marcado_por, auth.uid())
    );
  end if;

  return new;
end;
$$;
