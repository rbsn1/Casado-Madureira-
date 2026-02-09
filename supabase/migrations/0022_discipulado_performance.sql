-- Otimizações de performance para telas do Discipulado
-- Mudanças aditivas (sem remoção/renomeação).

create extension if not exists pg_trgm;

-- 1) Índices para reduzir custo dos dashboards/listas do discipulado
create index if not exists discipleship_cases_congregation_updated_idx
  on public.discipleship_cases (congregation_id, updated_at desc);

create index if not exists discipleship_cases_congregation_status_updated_idx
  on public.discipleship_cases (congregation_id, status, updated_at desc);

create index if not exists discipleship_cases_member_status_idx
  on public.discipleship_cases (member_id, status);

create index if not exists discipleship_progress_case_status_idx
  on public.discipleship_progress (case_id, status);

create index if not exists pessoas_congregation_nome_idx
  on public.pessoas (congregation_id, nome_completo);

create index if not exists pessoas_nome_trgm_idx
  on public.pessoas using gin (nome_completo gin_trgm_ops);

-- 2) Busca de membros do CCM para discipulado:
-- exige ao menos 2 caracteres para evitar scans caros em alto volume.
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
  is_global_admin boolean;
  safe_limit int;
  term text;
begin
  if not public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR', 'CADASTRADOR']) then
    raise exception 'not allowed';
  end if;

  is_global_admin := public.is_admin_master() or public.has_role(array['SUPER_ADMIN']);
  if is_global_admin then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
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
  where (effective_congregation is null or p.congregation_id = effective_congregation)
    and p.nome_completo ilike '%' || term || '%'
  order by p.nome_completo
  limit safe_limit;
end;
$$;

grant execute on function public.search_ccm_members_for_discipleship(text, int, uuid) to authenticated;

-- 3) RPC única para lista de convertidos com progresso agregado
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
  total_modules int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  safe_limit int;
begin
  if not (public.is_admin_master() or public.has_role(array['DISCIPULADOR'])) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  safe_limit := greatest(1, least(coalesce(rows_limit, 250), 1000));

  return query
  with filtered_cases as (
    select
      dc.id,
      dc.member_id,
      dc.status,
      dc.notes,
      dc.updated_at
    from public.discipleship_cases dc
    where (effective_congregation is null or dc.congregation_id = effective_congregation)
      and (
        status_filter is null
        or status_filter = ''
        or dc.status = status_filter
      )
    order by dc.updated_at desc
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
    coalesce(ps.total_modules, 0) as total_modules
  from filtered_cases fc
  join public.pessoas p on p.id = fc.member_id
  left join progress_stats ps on ps.case_id = fc.id
  order by fc.updated_at desc;
end;
$$;

grant execute on function public.list_discipleship_cases_summary(text, uuid, int) to authenticated;
