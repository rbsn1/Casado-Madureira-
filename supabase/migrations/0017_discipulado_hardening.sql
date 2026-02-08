-- Hardening: regras obrigatórias do discipulado, isolamento de papéis e segurança por congregação ativa

-- 1) Helper: status de congregação
create or replace function public.is_congregation_active(target_congregation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.congregations c
    where c.id = target_congregation_id
      and c.is_active is true
  );
$$;

grant execute on function public.is_congregation_active(uuid) to authenticated;

-- 2) Não permitir abrir case sem módulos ativos na congregação
create or replace function public.ensure_discipleship_case_has_active_modules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.discipleship_modules m
    where m.congregation_id = new.congregation_id
      and m.is_active is true
  ) then
    raise exception 'Esta congregação não possui módulos ativos de discipulado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_discipleship_case_has_active_modules on public.discipleship_cases;
create trigger trg_ensure_discipleship_case_has_active_modules
before insert on public.discipleship_cases
for each row execute function public.ensure_discipleship_case_has_active_modules();

-- 3) Conclusão exige progresso existente e 100% concluído
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
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_discipleship_case_conclusion on public.discipleship_cases;
create trigger trg_enforce_discipleship_case_conclusion
before update on public.discipleship_cases
for each row execute function public.enforce_discipleship_case_conclusion();

-- 4) Isolamento de papéis: DISCIPULADOR não pode coexistir ativo com papéis CCM/admin
create or replace function public.enforce_discipleship_role_isolation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.active, true) is true then
    if new.role = 'DISCIPULADOR' then
      if exists (
        select 1
        from public.usuarios_perfis up
        where up.user_id = new.user_id
          and up.active is true
          and up.role <> 'DISCIPULADOR'
      ) then
        raise exception 'Usuário DISCIPULADOR não pode possuir outros papéis ativos.';
      end if;
    else
      if exists (
        select 1
        from public.usuarios_perfis up
        where up.user_id = new.user_id
          and up.active is true
          and up.role = 'DISCIPULADOR'
          and up.role <> new.role
      ) then
        raise exception 'Usuário com DISCIPULADOR ativo não pode receber papéis do CCM/admin.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_discipleship_role_isolation on public.usuarios_perfis;
create trigger trg_enforce_discipleship_role_isolation
before insert or update on public.usuarios_perfis
for each row execute function public.enforce_discipleship_role_isolation();

-- 5) Policies do Discipulado: tenant precisa estar ativo
drop policy if exists "discipleship_cases_read" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage" on public.discipleship_cases;
drop policy if exists "discipleship_modules_read" on public.discipleship_modules;
drop policy if exists "discipleship_modules_manage" on public.discipleship_modules;
drop policy if exists "discipleship_progress_read" on public.discipleship_progress;
drop policy if exists "discipleship_progress_manage" on public.discipleship_progress;

create policy "discipleship_cases_read" on public.discipleship_cases
  for select
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

create policy "discipleship_cases_manage" on public.discipleship_cases
  for all
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  )
  with check (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

create policy "discipleship_modules_read" on public.discipleship_modules
  for select
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

create policy "discipleship_modules_manage" on public.discipleship_modules
  for all
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  )
  with check (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

create policy "discipleship_progress_read" on public.discipleship_progress
  for select
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

create policy "discipleship_progress_manage" on public.discipleship_progress
  for all
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  )
  with check (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

-- 6) Dashboard: tenant inativo não acessa
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
    if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
      raise exception 'congregation inactive';
    end if;
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
