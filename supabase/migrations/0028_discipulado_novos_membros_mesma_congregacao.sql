-- Discipulado: novos membros visíveis apenas na própria congregação.
-- Endurecimento aditivo para evitar leitura cross-congregação em cenários legados.

-- 1) Política base de pessoas (CCM):
-- remove escopo amplo quando o usuário também possui papel de Discipulado.
drop policy if exists "pessoas_read" on public.pessoas;
create policy "pessoas_read" on public.pessoas
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO','VOLUNTARIO'])
    and not public.has_role(array['DISCIPULADOR','SM_DISCIPULADO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 2) Bridge dedicada do Discipulado para leitura de membros do CCM:
-- sempre limitada à congregação ativa do usuário.
drop policy if exists "pessoas_read_discipulado_bridge" on public.pessoas;
create policy "pessoas_read_discipulado_bridge" on public.pessoas
  for select
  using (
    public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 3) Cases do discipulado: leitura restrita ao DISCIPULADOR da própria congregação ativa.
drop policy if exists "discipleship_cases_read" on public.discipleship_cases;
create policy "discipleship_cases_read" on public.discipleship_cases
  for select
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 4) Busca de membros do CCM para novo convertido:
-- perfis do Discipulado, sempre na congregação ativa do usuário.
create or replace function public.search_ccm_members_for_discipleship(
  search_text text default '',
  rows_limit int default 8,
  target_congregation_id uuid default null
)
returns table (
  id uuid,
  nome_completo text,
  telefone_whatsapp text,
  congregation_id uuid,
  cadastro_completo_status text,
  has_active_case boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  safe_limit int;
  term text;
begin
  if not public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  safe_limit := greatest(1, least(coalesce(rows_limit, 8), 20));
  term := btrim(coalesce(search_text, ''));

  if char_length(term) < 2 then
    return;
  end if;

  return query
  select
    p.id,
    p.nome_completo,
    p.telefone_whatsapp,
    p.congregation_id,
    p.cadastro_completo_status,
    exists (
      select 1
      from public.discipleship_cases dc
      where dc.member_id = p.id
        and dc.status in ('em_discipulado', 'pausado')
    ) as has_active_case
  from public.pessoas p
  where p.congregation_id = effective_congregation
    and p.nome_completo ilike '%' || term || '%'
  order by p.nome_completo
  limit safe_limit;
end;
$$;

grant execute on function public.search_ccm_members_for_discipleship(text, int, uuid) to authenticated;

-- 5) Lista de convertidos do discipulado:
-- somente DISCIPULADOR, sempre na própria congregação ativa.
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
  status text,
  notes text,
  updated_at timestamptz,
  done_modules int,
  total_modules int,
  criticality text,
  negative_contact_count int,
  days_to_confra int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  safe_limit int;
begin
  if not public.has_role(array['DISCIPULADOR']) then
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
      dc.status,
      dc.notes,
      dc.updated_at,
      dc.criticality,
      dc.negative_contact_count,
      dc.days_to_confra
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
    fc.status,
    fc.notes,
    fc.updated_at,
    coalesce(ps.done_modules, 0) as done_modules,
    coalesce(ps.total_modules, 0) as total_modules,
    coalesce(fc.criticality, 'BAIXA') as criticality,
    coalesce(fc.negative_contact_count, 0) as negative_contact_count,
    fc.days_to_confra
  from filtered_cases fc
  join public.pessoas p on p.id = fc.member_id
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

-- 6) Snapshot de membros sem case:
-- somente DISCIPULADOR, sempre na própria congregação ativa.
create or replace function public.get_discipleship_without_case_snapshot(
  target_congregation_id uuid default null,
  rows_limit int default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  safe_limit int := greatest(1, least(coalesce(rows_limit, 60), 200));
  payload jsonb;
begin
  if not public.has_role(array['DISCIPULADOR']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  with visible_members as (
    select p.id, p.nome_completo, p.telefone_whatsapp, p.created_at
    from public.pessoas p
    where p.congregation_id = effective_congregation
  ),
  without_case as (
    select vm.id, vm.nome_completo, vm.telefone_whatsapp, vm.created_at
    from visible_members vm
    where not exists (
      select 1
      from public.discipleship_cases dc
      where dc.member_id = vm.id
        and dc.status in ('em_discipulado', 'pausado')
    )
  ),
  counts as (
    select
      (select count(*) from visible_members)::int as visible_count,
      (select count(*) from without_case)::int as without_case_count
  ),
  rows as (
    select
      wc.id as member_id,
      wc.nome_completo as member_name,
      wc.telefone_whatsapp as member_phone,
      wc.created_at
    from without_case wc
    order by wc.created_at desc nulls last
    limit safe_limit
  )
  select jsonb_build_object(
    'visible_count', c.visible_count,
    'without_case_count', c.without_case_count,
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'member_id', r.member_id,
            'member_name', r.member_name,
            'member_phone', r.member_phone,
            'created_at', r.created_at
          )
          order by r.created_at desc nulls last
        )
        from rows r
      ),
      '[]'::jsonb
    )
  )
  into payload
  from counts c;

  return coalesce(payload, jsonb_build_object(
    'visible_count', 0,
    'without_case_count', 0,
    'rows', '[]'::jsonb
  ));
end;
$$;

grant execute on function public.get_discipleship_without_case_snapshot(uuid, int) to authenticated;
