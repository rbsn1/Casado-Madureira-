-- Expande o summary de cases para incluir campos usados nos paineis
-- e evitar roundtrip adicional ao carregar fase/confraternizacao/modulo/turno.

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
  turno_origem text
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
      dc.turno_origem
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
    fc.turno_origem::text as turno_origem
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
