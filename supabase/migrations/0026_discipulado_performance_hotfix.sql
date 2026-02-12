-- Hotfix de performance do Discipulado (aditivo e seguro).
-- Objetivo: reduzir round-trips e custo de queries de telas operacionais.

-- 1) Índices focados nas consultas mais frequentes do módulo.
create index if not exists integracao_novos_convertidos_pessoa_updated_idx
  on public.integracao_novos_convertidos (pessoa_id, updated_at desc);

create index if not exists batismos_pessoa_data_idx
  on public.batismos (pessoa_id, data desc);

create index if not exists pessoa_departamento_pessoa_status_idx
  on public.pessoa_departamento (pessoa_id, status);

create index if not exists departamentos_ativo_nome_idx
  on public.departamentos (ativo, nome);

create index if not exists discipleship_cases_congregation_criticality_days_updated_idx
  on public.discipleship_cases (congregation_id, criticality, days_to_confra, updated_at desc);

create index if not exists discipleship_cases_congregation_updated_idx
  on public.discipleship_cases (congregation_id, updated_at desc);

create index if not exists discipleship_modules_congregation_active_sort_idx
  on public.discipleship_modules (congregation_id, is_active, sort_order, title);

create index if not exists discipleship_progress_case_status_idx
  on public.discipleship_progress (case_id, status);

-- 2) Snapshot de membros do CCM sem case ativo no discipulado.
-- Evita trazer grandes listas ao cliente para filtrar em memória.
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
  if not (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN', 'DISCIPULADOR', 'CADASTRADOR'])
  ) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() or public.has_role(array['SUPER_ADMIN']) then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  with visible_members as (
    select p.id, p.nome_completo, p.telefone_whatsapp, p.created_at
    from public.pessoas p
    where (effective_congregation is null or p.congregation_id = effective_congregation)
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
