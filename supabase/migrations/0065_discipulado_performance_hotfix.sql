-- Hotfix de performance e escopo no Discipulado.

-- 1) Índice para listagem de membros CCM por congregação/origem/data.
create index if not exists pessoas_congregation_origem_created_idx
  on public.pessoas (congregation_id, cadastro_origem, created_at desc);

-- 2) Índices para filtros por período no impacto evangelístico (quando a tabela cultos existir).
do $$
begin
  if to_regclass('public.cultos') is not null then
    execute 'create index if not exists cultos_congregation_data_idx on public.cultos (congregation_id, data desc)';
    execute 'create index if not exists cultos_data_idx on public.cultos (data desc)';
  end if;
end
$$;

-- 3) Restringe listagem de "CCM" para não incluir cadastros originados no Discipulado.
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
  if not public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ]) then
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
    and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
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

-- 4) Corrige escopo da dashboard RPC para respeitar target_congregation_id em usuários globais.
create or replace function public.get_discipleship_dashboard(
  stale_days int default 14,
  target_congregation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  effective_congregation uuid;
begin
  if not public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ]) then
    raise exception 'not allowed';
  end if;

  if target_congregation_id is not null and (public.is_admin_master() or public.has_role(array['SUPER_ADMIN'])) then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  select jsonb_build_object(
    'cards', jsonb_build_object(
      'em_discipulado', (
        select count(*)
        from public.discipleship_cases dc
        where dc.congregation_id = effective_congregation
          and dc.status in ('pendente_matricula', 'em_discipulado')
      ),
      'concluidos', (
        select count(*)
        from public.discipleship_cases dc
        where dc.congregation_id = effective_congregation
          and dc.status = 'concluido'
      ),
      'parados', (
        select count(*)
        from public.discipleship_cases dc
        where dc.congregation_id = effective_congregation
          and dc.status = 'em_discipulado'
          and dc.updated_at < now() - make_interval(days => stale_days)
      ),
      'pendentes_criticos', (
        select count(*)
        from public.discipleship_cases dc
        where dc.congregation_id = effective_congregation
          and dc.status in ('em_discipulado', 'pausado')
          and dc.updated_at < now() - interval '21 days'
      ),
      'proximos_a_concluir', (
        with progress as (
          select
            dc.id,
            count(dp.id) as total_modules,
            count(*) filter (where dp.status = 'concluido') as done_modules
          from public.discipleship_cases dc
          left join public.discipleship_progress dp on dp.case_id = dc.id
          where dc.congregation_id = effective_congregation
            and dc.status in ('em_discipulado', 'pausado')
          group by dc.id
        )
        select count(*)
        from progress
        where total_modules > 0
          and done_modules < total_modules
          and (done_modules::numeric / total_modules::numeric) >= 0.75
      )
    ),
    'parados_lista', (
      with progress as (
        select
          dc.id,
          p.nome_completo as member_name,
          dc.updated_at,
          count(dp.id) as total_modules,
          count(*) filter (where dp.status = 'concluido') as done_modules
        from public.discipleship_cases dc
        join public.pessoas p on p.id = dc.member_id
        left join public.discipleship_progress dp on dp.case_id = dc.id
        where dc.congregation_id = effective_congregation
          and dc.status = 'em_discipulado'
          and dc.updated_at < now() - make_interval(days => stale_days)
        group by dc.id, p.nome_completo, dc.updated_at
        order by dc.updated_at asc
        limit 8
      )
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', id,
          'member_name', member_name,
          'days_without_activity', greatest(extract(day from now() - updated_at)::int, 0),
          'progress', case when total_modules = 0 then 0 else round((done_modules::numeric / total_modules::numeric) * 100, 0) end
        )
      ), '[]'::jsonb)
      from progress
    ),
    'proximos_lista', (
      with progress as (
        select
          dc.id,
          p.nome_completo as member_name,
          count(dp.id) as total_modules,
          count(*) filter (where dp.status = 'concluido') as done_modules
        from public.discipleship_cases dc
        join public.pessoas p on p.id = dc.member_id
        left join public.discipleship_progress dp on dp.case_id = dc.id
        where dc.congregation_id = effective_congregation
          and dc.status in ('em_discipulado', 'pausado')
        group by dc.id, p.nome_completo
      )
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', id,
          'member_name', member_name,
          'done_modules', done_modules,
          'total_modules', total_modules,
          'progress', case when total_modules = 0 then 0 else round((done_modules::numeric / total_modules::numeric) * 100, 0) end
        )
        order by (case when total_modules = 0 then 0 else done_modules::numeric / total_modules::numeric end) desc
      ), '[]'::jsonb)
      from (
        select *
        from progress
        where total_modules > 0
          and done_modules < total_modules
          and (done_modules::numeric / total_modules::numeric) >= 0.75
        order by (done_modules::numeric / total_modules::numeric) desc
        limit 8
      ) ranked
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_discipleship_dashboard(int, uuid) to authenticated;
