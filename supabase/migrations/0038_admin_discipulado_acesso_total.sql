-- ADMIN_DISCIPULADO deve ter acesso total aos recursos do módulo de Discipulado
-- (mesmo escopo por congregação do DISCIPULADOR).

-- 1) Bridge de leitura de membros do CCM para Discipulado (inclui ADMIN_DISCIPULADO).
drop policy if exists "pessoas_read_discipulado_bridge" on public.pessoas;
create policy "pessoas_read_discipulado_bridge" on public.pessoas
  for select
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 2) Cases do discipulado (inclui ADMIN_DISCIPULADO).
drop policy if exists "discipleship_cases_read" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage_update" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage_delete" on public.discipleship_cases;
drop policy if exists "discipleship_cases_insert_discipulado" on public.discipleship_cases;

create policy "discipleship_cases_read" on public.discipleship_cases
  for select
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_cases_manage_update" on public.discipleship_cases
  for update
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_cases_manage_delete" on public.discipleship_cases
  for delete
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_cases_insert_discipulado" on public.discipleship_cases
  for insert
  with check (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 3) Módulos e progresso (inclui ADMIN_DISCIPULADO).
drop policy if exists "discipleship_modules_read" on public.discipleship_modules;
drop policy if exists "discipleship_modules_manage" on public.discipleship_modules;
drop policy if exists "discipleship_progress_read" on public.discipleship_progress;
drop policy if exists "discipleship_progress_manage" on public.discipleship_progress;

create policy "discipleship_modules_read" on public.discipleship_modules
  for select
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_modules_manage" on public.discipleship_modules
  for all
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_progress_read" on public.discipleship_progress
  for select
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_progress_manage" on public.discipleship_progress
  for all
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 4) Calendário e tentativas de contato (inclui ADMIN_DISCIPULADO).
drop policy if exists "discipleship_calendar_read" on public.discipleship_calendar;
drop policy if exists "discipleship_calendar_manage" on public.discipleship_calendar;
drop policy if exists "contact_attempts_read" on public.contact_attempts;
drop policy if exists "contact_attempts_manage" on public.contact_attempts;

create policy "discipleship_calendar_read" on public.discipleship_calendar
  for select
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "discipleship_calendar_manage" on public.discipleship_calendar
  for all
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "contact_attempts_read" on public.contact_attempts
  for select
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

create policy "contact_attempts_manage" on public.contact_attempts
  for all
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  )
  with check (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 5) RPCs do Discipulado (inclui ADMIN_DISCIPULADO).
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
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
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
        and dc.status in ('em_discipulado', 'pausado')
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

create or replace function public.update_ccm_member_profile_from_discipleship(
  target_member_id uuid,
  full_name text,
  phone_whatsapp text,
  origin text default null,
  origin_church text default null,
  neighborhood text default null,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  normalized_name text := btrim(coalesce(full_name, ''));
  normalized_phone text := nullif(btrim(coalesce(phone_whatsapp, '')), '');
  normalized_origin text := nullif(btrim(coalesce(origin, '')), '');
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes, '')), '');
  updated_member_id uuid;
begin
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  if target_member_id is null then
    raise exception 'Membro inválido.';
  end if;

  if normalized_name = '' then
    raise exception 'Nome completo é obrigatório.';
  end if;

  if normalized_phone is null then
    raise exception 'Telefone é obrigatório.';
  end if;

  if normalized_neighborhood is not null and char_length(normalized_neighborhood) < 2 then
    raise exception 'Bairro precisa ter ao menos 2 caracteres.';
  end if;

  update public.pessoas p
  set nome_completo = normalized_name,
      telefone_whatsapp = normalized_phone,
      origem = normalized_origin,
      igreja_origem = normalized_origin_church,
      bairro = normalized_neighborhood,
      observacoes = normalized_notes
  where p.id = target_member_id
    and p.congregation_id = effective_congregation
  returning p.id into updated_member_id;

  if updated_member_id is null then
    raise exception 'Membro não encontrado para a sua congregação.';
  end if;

  perform public.log_timeline(
    updated_member_id,
    'CADASTRO',
    'Cadastro atualizado no módulo de discipulado',
    jsonb_build_object('source', 'discipulado')
  );
end;
$$;

grant execute on function public.update_ccm_member_profile_from_discipleship(uuid, text, text, text, text, text, text) to authenticated;

create or replace function public.create_ccm_member_from_discipleship(
  full_name text,
  phone_whatsapp text,
  origin text default null,
  origin_church text default null,
  neighborhood text default null,
  notes text default null
)
returns table (
  member_id uuid,
  nome_completo text,
  telefone_whatsapp text,
  congregation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  normalized_name text := btrim(coalesce(full_name, ''));
  raw_digits text := regexp_replace(coalesce(phone_whatsapp, ''), '\\D', '', 'g');
  normalized_phone text;
  normalized_origin text := nullif(btrim(coalesce(origin, '')), '');
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes, '')), '');
begin
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  if normalized_name = '' or char_length(normalized_name) < 3 then
    raise exception 'Nome completo inválido.';
  end if;

  if raw_digits like '55%' and char_length(raw_digits) in (12, 13) then
    raw_digits := substr(raw_digits, 3);
  end if;

  if char_length(raw_digits) not in (10, 11) then
    raise exception 'Telefone inválido. Informe DDD + número.';
  end if;

  if char_length(raw_digits) = 11 then
    normalized_phone := '(' || substr(raw_digits, 1, 2) || ') ' || substr(raw_digits, 3, 5) || '-' || substr(raw_digits, 8, 4);
  else
    normalized_phone := '(' || substr(raw_digits, 1, 2) || ') ' || substr(raw_digits, 3, 4) || '-' || substr(raw_digits, 7, 4);
  end if;

  if normalized_neighborhood is not null and char_length(normalized_neighborhood) < 2 then
    raise exception 'Bairro precisa ter ao menos 2 caracteres.';
  end if;

  return query
  insert into public.pessoas (
    nome_completo,
    telefone_whatsapp,
    origem,
    igreja_origem,
    bairro,
    observacoes,
    congregation_id,
    request_id
  )
  values (
    normalized_name,
    normalized_phone,
    normalized_origin,
    normalized_origin_church,
    normalized_neighborhood,
    normalized_notes,
    effective_congregation,
    gen_random_uuid()
  )
  returning
    id as member_id,
    public.pessoas.nome_completo,
    public.pessoas.telefone_whatsapp,
    public.pessoas.congregation_id;
end;
$$;

grant execute on function public.create_ccm_member_from_discipleship(text, text, text, text, text, text) to authenticated;

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
    fc.assigned_to,
    au.email::text as discipulador_email,
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
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR']) then
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
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR']) then
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
  is_discipulador boolean := false;
  is_cadastro_discipulado boolean := false;
begin
  if auth.uid() is not null then
    is_discipulador := public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR']);
    is_cadastro_discipulado := public.has_role(array['SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']);

    if not (is_discipulador or is_cadastro_discipulado) then
      raise exception 'not allowed';
    end if;

    my_congregation := public.get_my_congregation_id();
    if my_congregation is null or not public.is_congregation_active(my_congregation) then
      raise exception 'congregation inactive';
    end if;

    if target_congregation_id is not null and target_congregation_id <> my_congregation then
      raise exception 'not allowed';
    end if;

    if is_cadastro_discipulado and not is_discipulador then
      if target_case_id is null then
        raise exception 'not allowed';
      end if;
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

