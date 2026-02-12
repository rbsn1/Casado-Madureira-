-- Isolamento total do módulo Discipulado:
-- somente perfis do Discipulado podem acessar recursos do módulo.
-- ADMIN_MASTER/SUPER_ADMIN (CCM) deixam de ter acesso ao Discipulado.

create or replace function public.is_discipulado_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO']);
$$;

grant execute on function public.is_discipulado_user() to authenticated;

-- Bridge de leitura de membros CCM para Discipulado (somente perfis do Discipulado).
drop policy if exists "pessoas_read_discipulado_bridge" on public.pessoas;
drop policy if exists "pessoas_read_cadastrador_discipulado" on public.pessoas;
drop policy if exists "pessoas_read_sm_discipulado" on public.pessoas;

create policy "pessoas_read_discipulado_bridge" on public.pessoas
  for select
  using (
    public.is_discipulado_user()
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- Discipleship cases: leitura/gestão por DISCIPULADOR; criação por DISCIPULADOR ou SM_DISCIPULADO.
drop policy if exists "discipleship_cases_read" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage_update" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage_delete" on public.discipleship_cases;
drop policy if exists "discipleship_cases_insert_cadastrador" on public.discipleship_cases;
drop policy if exists "discipleship_cases_insert_sm_discipulado" on public.discipleship_cases;

create policy "discipleship_cases_read" on public.discipleship_cases
  for select
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_cases_manage_update" on public.discipleship_cases
  for update
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_cases_manage_delete" on public.discipleship_cases
  for delete
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_cases_insert_discipulado" on public.discipleship_cases
  for insert
  with check (
    public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- Módulos e progresso: somente DISCIPULADOR.
drop policy if exists "discipleship_modules_read" on public.discipleship_modules;
drop policy if exists "discipleship_modules_manage" on public.discipleship_modules;
drop policy if exists "discipleship_progress_read" on public.discipleship_progress;
drop policy if exists "discipleship_progress_manage" on public.discipleship_progress;

create policy "discipleship_modules_read" on public.discipleship_modules
  for select
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_modules_manage" on public.discipleship_modules
  for all
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_progress_read" on public.discipleship_progress
  for select
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_progress_manage" on public.discipleship_progress
  for all
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- Calendário e tentativas de contato: somente DISCIPULADOR.
drop policy if exists "discipleship_calendar_read" on public.discipleship_calendar;
drop policy if exists "discipleship_calendar_manage" on public.discipleship_calendar;
drop policy if exists "contact_attempts_read" on public.contact_attempts;
drop policy if exists "contact_attempts_manage" on public.contact_attempts;

create policy "discipleship_calendar_read" on public.discipleship_calendar
  for select
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_calendar_manage" on public.discipleship_calendar
  for all
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "contact_attempts_read" on public.contact_attempts
  for select
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "contact_attempts_manage" on public.contact_attempts
  for all
  using (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- Busca de membros do CCM para novo convertido: perfis do Discipulado.
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

-- Lista de cases com criticidade: somente DISCIPULADOR da própria congregação.
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

-- Dashboard do Discipulado: somente DISCIPULADOR.
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
  if not public.has_role(array['DISCIPULADOR']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  select jsonb_build_object(
    'cards', jsonb_build_object(
      'em_discipulado', (
        select count(*)
        from public.discipleship_cases dc
        where dc.congregation_id = effective_congregation
          and dc.status = 'em_discipulado'
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

-- Snapshot de membros do CCM sem case: somente DISCIPULADOR.
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

-- Recalcula criticidade apenas por DISCIPULADOR no contexto autenticado.
create or replace function public.refresh_discipleship_case_criticality(
  target_congregation_id uuid default null,
  target_case_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int := 0;
  my_congregation uuid;
begin
  if auth.uid() is not null then
    if not public.has_role(array['DISCIPULADOR']) then
      raise exception 'not allowed';
    end if;

    my_congregation := public.get_my_congregation_id();
    if my_congregation is null or not public.is_congregation_active(my_congregation) then
      raise exception 'congregation inactive';
    end if;

    if target_congregation_id is not null and target_congregation_id <> my_congregation then
      raise exception 'not allowed';
    end if;
  else
    my_congregation := target_congregation_id;
  end if;

  with scoped_cases as (
    select dc.id, dc.congregation_id
    from public.discipleship_cases dc
    where (target_congregation_id is null or dc.congregation_id = target_congregation_id)
      and (target_case_id is null or dc.id = target_case_id)
      and (my_congregation is null or dc.congregation_id = my_congregation)
  ),
  negative_stats as (
    select
      ca.case_id,
      count(*) filter (where public.is_negative_contact_outcome(ca.outcome))::int as negative_contact_count,
      max(ca.created_at) filter (where public.is_negative_contact_outcome(ca.outcome)) as last_negative_contact_at
    from public.contact_attempts ca
    join scoped_cases sc on sc.id = ca.case_id
    group by ca.case_id
  ),
  confra as (
    select
      dc.congregation_id,
      greatest(0, ceil(extract(epoch from (dc.confraternization_at - now())) / 86400.0)::int) as days_to_confra
    from public.discipleship_calendar dc
  ),
  computed as (
    select
      sc.id as case_id,
      coalesce(ns.negative_contact_count, 0) as negative_contact_count,
      cf.days_to_confra,
      ns.last_negative_contact_at,
      public.classify_discipleship_criticality(
        cf.days_to_confra,
        coalesce(ns.negative_contact_count, 0)
      ) as criticality
    from scoped_cases sc
    left join negative_stats ns on ns.case_id = sc.id
    left join confra cf on cf.congregation_id = sc.congregation_id
  ),
  updated as (
    update public.discipleship_cases dc
    set
      negative_contact_count = c.negative_contact_count,
      days_to_confra = c.days_to_confra,
      criticality = c.criticality,
      last_negative_contact_at = c.last_negative_contact_at
    from computed c
    where dc.id = c.case_id
    returning 1
  )
  select count(*) into updated_count
  from updated;

  return coalesce(updated_count, 0);
end;
$$;

grant execute on function public.refresh_discipleship_case_criticality(uuid, uuid) to authenticated;
