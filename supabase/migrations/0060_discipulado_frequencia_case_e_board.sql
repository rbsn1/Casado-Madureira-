-- Discipulado: acompanhamento de frequencia no case e no board.

alter table public.discipleship_cases
  add column if not exists attendance_total_classes int not null default 0,
  add column if not exists attendance_present_count int not null default 0,
  add column if not exists attendance_absent_count int not null default 0,
  add column if not exists attendance_justified_count int not null default 0,
  add column if not exists attendance_presence_rate numeric(5,2) not null default 0;

create or replace function public.refresh_discipleship_case_attendance(
  target_case_id uuid default null,
  target_member_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int := 0;
begin
  if auth.uid() is not null and not (
    public.is_admin_master()
    or public.has_role(array[
      'SUPER_ADMIN',
      'ADMIN_DISCIPULADO',
      'DISCIPULADOR',
      'SM_DISCIPULADO',
      'SECRETARIA_DISCIPULADO'
    ])
  ) then
    raise exception 'not allowed';
  end if;

  with scoped_cases as (
    select dc.id, dc.member_id
    from public.discipleship_cases dc
    where (target_case_id is null or dc.id = target_case_id)
      and (target_member_id is null or dc.member_id = target_member_id)
  ),
  attendance_stats as (
    select
      sc.id as case_id,
      count(*) filter (where ci.status is not null)::int as total_classes,
      count(*) filter (where ci.status = 'PRESENTE')::int as present_count,
      count(*) filter (where ci.status = 'FALTA')::int as absent_count,
      count(*) filter (where ci.status = 'JUSTIFICADA')::int as justified_count
    from scoped_cases sc
    left join public.discipleship_chamada_itens ci
      on ci.aluno_id = sc.member_id
    group by sc.id
  ),
  updated as (
    update public.discipleship_cases dc
    set attendance_total_classes = coalesce(stats.total_classes, 0),
        attendance_present_count = coalesce(stats.present_count, 0),
        attendance_absent_count = coalesce(stats.absent_count, 0),
        attendance_justified_count = coalesce(stats.justified_count, 0),
        attendance_presence_rate = case
          when coalesce(stats.total_classes, 0) > 0
            then round(((coalesce(stats.present_count, 0)::numeric * 100.0) / stats.total_classes::numeric), 2)
          else 0
        end
    from attendance_stats stats
    where dc.id = stats.case_id
    returning dc.id
  )
  select count(*)::int into updated_count from updated;

  return updated_count;
end;
$$;

grant execute on function public.refresh_discipleship_case_attendance(uuid, uuid) to authenticated;

create or replace function public.handle_discipleship_case_attendance_from_chamada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member_id uuid;
begin
  if tg_op = 'DELETE' then
    target_member_id := old.aluno_id;
  else
    target_member_id := new.aluno_id;
  end if;

  perform public.refresh_discipleship_case_attendance(
    null,
    target_member_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_discipleship_case_attendance_from_chamada on public.discipleship_chamada_itens;
create trigger trg_refresh_discipleship_case_attendance_from_chamada
after insert or update or delete on public.discipleship_chamada_itens
for each row execute function public.handle_discipleship_case_attendance_from_chamada();

create or replace function public.enforce_discipleship_case_conclusion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluido' and old.status <> 'concluido' then
    if not exists (
      select 1
      from public.discipleship_progress dp
      where dp.case_id = new.id
    ) then
      raise exception 'Não é possível concluir o discipulado sem módulos de progresso.';
    end if;

    if exists (
      select 1
      from public.discipleship_progress dp
      where dp.case_id = new.id
        and dp.status <> 'concluido'
    ) then
      raise exception 'Só é possível concluir o discipulado quando todos os módulos estiverem concluídos.';
    end if;

    if coalesce(new.attendance_total_classes, 0) < 1 then
      raise exception 'Só é possível concluir o discipulado com ao menos 1 chamada registrada.';
    end if;

    if coalesce(new.attendance_presence_rate, 0) < 75 then
      raise exception 'Só é possível concluir o discipulado com frequência mínima de 75%%.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.list_discipleship_cases_summary(
  status_filter text default null,
  target_congregation_id uuid default null,
  rows_limit int default 250
)
returns table (
  case_id uuid,
  member_id uuid,
  member_name text,
  member_phone text,
  assigned_to uuid,
  discipulador_email text,
  status text,
  notes text,
  updated_at timestamptz,
  done_modules int,
  total_modules int,
  criticality text,
  negative_contact_count int,
  days_to_confra int,
  confraternizacao_id uuid,
  confraternizacao_confirmada boolean,
  confraternizacao_confirmada_em timestamptz,
  confraternizacao_compareceu boolean,
  confraternizacao_compareceu_em timestamptz,
  fase text,
  modulo_atual_id uuid,
  turno_origem text,
  attendance_total_classes int,
  attendance_present_count int,
  attendance_absent_count int,
  attendance_justified_count int,
  attendance_presence_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  safe_limit int;
begin
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  safe_limit := greatest(1, least(coalesce(rows_limit, 250), 1000));

  return query
  with filtered_cases as (
    select
      dc.id,
      dc.member_id,
      dc.assigned_to,
      dc.status,
      dc.notes,
      dc.updated_at,
      dc.criticality,
      dc.negative_contact_count,
      dc.days_to_confra,
      dc.confraternizacao_id,
      dc.confraternizacao_confirmada,
      dc.confraternizacao_confirmada_em,
      dc.confraternizacao_compareceu,
      dc.confraternizacao_compareceu_em,
      dc.fase,
      dc.modulo_atual_id,
      dc.turno_origem,
      dc.attendance_total_classes,
      dc.attendance_present_count,
      dc.attendance_absent_count,
      dc.attendance_justified_count,
      dc.attendance_presence_rate
    from public.discipleship_cases dc
    where dc.congregation_id = effective_congregation
      and (
        status_filter is null
        or status_filter = ''
        or dc.status = status_filter
      )
    order by
      case coalesce(dc.criticality, 'BAIXA')
        when 'CRITICA' then 4
        when 'ALTA' then 3
        when 'MEDIA' then 2
        else 1
      end desc,
      dc.days_to_confra asc nulls last,
      dc.updated_at desc
    limit safe_limit
  ),
  progress_stats as (
    select
      dp.case_id,
      count(*)::int as total_modules,
      count(*) filter (where dp.status = 'concluido')::int as done_modules
    from public.discipleship_progress dp
    join filtered_cases fc on fc.id = dp.case_id
    group by dp.case_id
  )
  select
    fc.id as case_id,
    fc.member_id,
    p.nome_completo as member_name,
    p.telefone_whatsapp as member_phone,
    fc.assigned_to,
    au.email::text as discipulador_email,
    fc.status,
    fc.notes,
    fc.updated_at,
    coalesce(ps.done_modules, 0) as done_modules,
    coalesce(ps.total_modules, 0) as total_modules,
    coalesce(fc.criticality, 'BAIXA') as criticality,
    coalesce(fc.negative_contact_count, 0) as negative_contact_count,
    fc.days_to_confra,
    fc.confraternizacao_id,
    coalesce(fc.confraternizacao_confirmada, false) as confraternizacao_confirmada,
    fc.confraternizacao_confirmada_em,
    coalesce(fc.confraternizacao_compareceu, false) as confraternizacao_compareceu,
    fc.confraternizacao_compareceu_em,
    coalesce(fc.fase, 'ACOLHIMENTO')::text as fase,
    fc.modulo_atual_id,
    fc.turno_origem::text as turno_origem,
    coalesce(fc.attendance_total_classes, 0) as attendance_total_classes,
    coalesce(fc.attendance_present_count, 0) as attendance_present_count,
    coalesce(fc.attendance_absent_count, 0) as attendance_absent_count,
    coalesce(fc.attendance_justified_count, 0) as attendance_justified_count,
    coalesce(fc.attendance_presence_rate, 0)::numeric as attendance_presence_rate
  from filtered_cases fc
  join public.pessoas p on p.id = fc.member_id
  left join auth.users au on au.id = fc.assigned_to
  left join progress_stats ps on ps.case_id = fc.id
  order by
    case coalesce(fc.criticality, 'BAIXA')
      when 'CRITICA' then 4
      when 'ALTA' then 3
      when 'MEDIA' then 2
      else 1
    end desc,
    fc.days_to_confra asc nulls last,
    fc.updated_at desc;
end;
$$;

grant execute on function public.list_discipleship_cases_summary(text, uuid, int) to authenticated;

select public.refresh_discipleship_case_attendance(null, null);
