-- Aditivo: suporte a SUPER_ADMIN no Discipulado e contexto administrativo

-- 1) Permite SUPER_ADMIN na matriz de roles
alter table public.usuarios_perfis
  drop constraint if exists usuarios_perfis_role_check;

alter table public.usuarios_perfis
  add constraint usuarios_perfis_role_check
  check (
    role in (
      'ADMIN_MASTER',
      'SUPER_ADMIN',
      'PASTOR',
      'SECRETARIA',
      'NOVOS_CONVERTIDOS',
      'LIDER_DEPTO',
      'VOLUNTARIO',
      'CADASTRADOR',
      'DISCIPULADOR'
    )
  );

-- 2) Admin global: ADMIN_MASTER, SUPER_ADMIN ou profiles.role = 'admin'
create or replace function public.is_admin_master()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_admin boolean := false;
begin
  if to_regclass('public.profiles') is not null then
    execute
      'select exists (
         select 1
         from public.profiles p
         where p.id = auth.uid()
           and p.role = ''admin''
       )'
    into profile_admin;
  end if;

  return profile_admin or public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN']);
end;
$$;

grant execute on function public.is_admin_master() to authenticated;

-- 3) Congregações: admin global visualiza/gerencia tudo
drop policy if exists "congregations_read" on public.congregations;
drop policy if exists "congregations_manage_admin" on public.congregations;

create policy "congregations_read" on public.congregations
  for select
  using (
    auth.role() = 'authenticated'
    and (
      public.is_admin_master()
      or id = public.get_my_congregation_id()
    )
  );

create policy "congregations_manage_admin" on public.congregations
  for all
  using (public.is_admin_master())
  with check (public.is_admin_master());

-- 4) Policies do Discipulado: DISCIPULADOR ou admin global
drop policy if exists "discipleship_cases_read" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage" on public.discipleship_cases;
drop policy if exists "discipleship_modules_read" on public.discipleship_modules;
drop policy if exists "discipleship_modules_manage" on public.discipleship_modules;
drop policy if exists "discipleship_progress_read" on public.discipleship_progress;
drop policy if exists "discipleship_progress_manage" on public.discipleship_progress;

create policy "discipleship_cases_read" on public.discipleship_cases
  for select
  using (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_cases_manage" on public.discipleship_cases
  for all
  using (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_modules_read" on public.discipleship_modules
  for select
  using (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_modules_manage" on public.discipleship_modules
  for all
  using (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_progress_read" on public.discipleship_progress
  for select
  using (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_progress_manage" on public.discipleship_progress
  for all
  using (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 5) Dashboard Discipulado: libera SUPER_ADMIN/admin global
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
  if not (public.is_admin_master() or public.has_role(array['DISCIPULADOR'])) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  select jsonb_build_object(
    'cards', jsonb_build_object(
      'em_discipulado', (
        select count(*)
        from public.discipleship_cases dc
        where (effective_congregation is null or dc.congregation_id = effective_congregation)
          and dc.status = 'em_discipulado'
      ),
      'concluidos', (
        select count(*)
        from public.discipleship_cases dc
        where (effective_congregation is null or dc.congregation_id = effective_congregation)
          and dc.status = 'concluido'
      ),
      'parados', (
        select count(*)
        from public.discipleship_cases dc
        where (effective_congregation is null or dc.congregation_id = effective_congregation)
          and dc.status = 'em_discipulado'
          and dc.updated_at < now() - make_interval(days => stale_days)
      ),
      'pendentes_criticos', (
        select count(*)
        from public.discipleship_cases dc
        where (effective_congregation is null or dc.congregation_id = effective_congregation)
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
          where (effective_congregation is null or dc.congregation_id = effective_congregation)
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
        where (effective_congregation is null or dc.congregation_id = effective_congregation)
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
        where (effective_congregation is null or dc.congregation_id = effective_congregation)
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
