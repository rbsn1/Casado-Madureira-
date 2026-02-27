-- Discipulado: registra eventos de chamada no historico (timeline) da pessoa.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'timeline_tipo'
      and e.enumlabel = 'CHAMADA'
  ) then
    alter type public.timeline_tipo add value 'CHAMADA';
  end if;
end
$$;

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

  return new;
end;
$$;

drop trigger if exists trg_log_discipleship_chamada_timeline on public.discipleship_chamada_itens;
create trigger trg_log_discipleship_chamada_timeline
after insert or update of status on public.discipleship_chamada_itens
for each row execute function public.log_discipleship_chamada_timeline();
