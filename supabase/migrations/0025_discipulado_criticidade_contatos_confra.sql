-- Criticidade por contatos negativos + proximidade da confraternização.
-- Mudança aditiva: sem remoção/renomeação de tabela/coluna/dados.

-- 1) Calendário do discipulado por congregação (data da confra).
create table if not exists public.discipleship_calendar (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  confraternization_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (congregation_id)
);

alter table public.discipleship_calendar enable row level security;

drop trigger if exists trg_touch_discipleship_calendar on public.discipleship_calendar;
create trigger trg_touch_discipleship_calendar
before update on public.discipleship_calendar
for each row execute function public.touch_updated_at();

drop policy if exists "discipleship_calendar_read" on public.discipleship_calendar;
drop policy if exists "discipleship_calendar_manage" on public.discipleship_calendar;

create policy "discipleship_calendar_read" on public.discipleship_calendar
  for select
  using (
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_calendar_manage" on public.discipleship_calendar
  for all
  using (
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create index if not exists discipleship_calendar_congregation_idx
  on public.discipleship_calendar (congregation_id);

-- 2) Log de tentativas de contato.
create table if not exists public.contact_attempts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipleship_cases(id) on delete cascade,
  member_id uuid not null references public.pessoas(id) on delete cascade,
  congregation_id uuid not null references public.congregations(id) on delete restrict,
  outcome text not null
    check (outcome in ('no_answer', 'wrong_number', 'refused', 'sem_resposta', 'contacted', 'scheduled_visit')),
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp', 'ligacao', 'visita', 'outro')),
  notes text null,
  attempted_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_attempts enable row level security;

drop trigger if exists trg_touch_contact_attempts on public.contact_attempts;
create trigger trg_touch_contact_attempts
before update on public.contact_attempts
for each row execute function public.touch_updated_at();

drop policy if exists "contact_attempts_read" on public.contact_attempts;
drop policy if exists "contact_attempts_manage" on public.contact_attempts;

create policy "contact_attempts_read" on public.contact_attempts
  for select
  using (
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "contact_attempts_manage" on public.contact_attempts
  for all
  using (
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create index if not exists contact_attempts_case_created_idx
  on public.contact_attempts (case_id, created_at desc);

create index if not exists contact_attempts_congregation_outcome_created_idx
  on public.contact_attempts (congregation_id, outcome, created_at desc);

create index if not exists contact_attempts_case_outcome_idx
  on public.contact_attempts (case_id, outcome);

-- 3) Persistência da criticidade em discipleship_cases.
alter table public.discipleship_cases
  add column if not exists negative_contact_count int not null default 0,
  add column if not exists days_to_confra int null,
  add column if not exists criticality text not null default 'BAIXA',
  add column if not exists last_negative_contact_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discipleship_cases_criticality_check'
      and conrelid = 'public.discipleship_cases'::regclass
  ) then
    alter table public.discipleship_cases
      add constraint discipleship_cases_criticality_check
      check (criticality in ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA'));
  end if;
end
$$;

create index if not exists discipleship_cases_congregation_criticality_days_idx
  on public.discipleship_cases (congregation_id, criticality, days_to_confra);

create index if not exists discipleship_cases_negative_contact_count_idx
  on public.discipleship_cases (negative_contact_count);

-- 4) Funções de criticidade.
create or replace function public.is_negative_contact_outcome(target_outcome text)
returns boolean
language sql
immutable
as $$
  select coalesce(target_outcome, '') in ('no_answer', 'wrong_number', 'refused', 'sem_resposta');
$$;

create or replace function public.classify_discipleship_criticality(
  target_days_to_confra int,
  target_negative_count int
)
returns text
language plpgsql
immutable
as $$
declare
  days_value int := coalesce(target_days_to_confra, 999999);
  negative_value int := greatest(coalesce(target_negative_count, 0), 0);
begin
  if days_value > 14 then
    if negative_value = 0 then
      return 'BAIXA';
    elsif negative_value = 1 then
      return 'MEDIA';
    else
      return 'ALTA';
    end if;
  elsif days_value >= 7 then
    if negative_value = 0 then
      return 'MEDIA';
    elsif negative_value = 1 then
      return 'ALTA';
    else
      return 'CRITICA';
    end if;
  else
    if negative_value = 0 then
      return 'ALTA';
    else
      return 'CRITICA';
    end if;
  end if;
end;
$$;

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
begin
  if auth.uid() is not null and not (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN', 'DISCIPULADOR'])
  ) then
    raise exception 'not allowed';
  end if;

  with scoped_cases as (
    select dc.id, dc.congregation_id
    from public.discipleship_cases dc
    where (target_congregation_id is null or dc.congregation_id = target_congregation_id)
      and (target_case_id is null or dc.id = target_case_id)
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

grant execute on function public.is_negative_contact_outcome(text) to authenticated;
grant execute on function public.classify_discipleship_criticality(int, int) to authenticated;
grant execute on function public.refresh_discipleship_case_criticality(uuid, uuid) to authenticated;

create or replace function public.sync_contact_attempt_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  case_member_id uuid;
  case_congregation_id uuid;
begin
  select dc.member_id, dc.congregation_id
  into case_member_id, case_congregation_id
  from public.discipleship_cases dc
  where dc.id = new.case_id;

  if case_member_id is null or case_congregation_id is null then
    raise exception 'Case de discipulado inválido para contato.';
  end if;

  new.member_id := case_member_id;
  new.congregation_id := case_congregation_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_contact_attempt_context on public.contact_attempts;
create trigger trg_sync_contact_attempt_context
before insert or update on public.contact_attempts
for each row execute function public.sync_contact_attempt_context();

create or replace function public.handle_contact_attempt_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_discipleship_case_criticality(
    null,
    coalesce(new.case_id, old.case_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_case_criticality_on_contact_attempt on public.contact_attempts;
create trigger trg_refresh_case_criticality_on_contact_attempt
after insert or update or delete on public.contact_attempts
for each row execute function public.handle_contact_attempt_change();

create or replace function public.handle_discipleship_calendar_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_discipleship_case_criticality(new.congregation_id, null);
  return new;
end;
$$;

drop trigger if exists trg_refresh_case_criticality_on_calendar on public.discipleship_calendar;
create trigger trg_refresh_case_criticality_on_calendar
after insert or update of confraternization_at on public.discipleship_calendar
for each row execute function public.handle_discipleship_calendar_change();

create or replace function public.handle_discipleship_case_criticality_init()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_discipleship_case_criticality(null, new.id);
  return new;
end;
$$;

drop trigger if exists trg_init_case_criticality on public.discipleship_cases;
create trigger trg_init_case_criticality
after insert on public.discipleship_cases
for each row execute function public.handle_discipleship_case_criticality_init();

create or replace function public.refresh_discipleship_case_criticality_daily()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.refresh_discipleship_case_criticality(null, null);
end;
$$;

grant execute on function public.refresh_discipleship_case_criticality_daily() to authenticated;

-- 5) Atualiza RPC da fila/lista com dados de criticidade.
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
  if not (public.is_admin_master() or public.has_role(array['SUPER_ADMIN', 'DISCIPULADOR'])) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() or public.has_role(array['SUPER_ADMIN']) then
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
      dc.updated_at,
      dc.criticality,
      dc.negative_contact_count,
      dc.days_to_confra
    from public.discipleship_cases dc
    where (effective_congregation is null or dc.congregation_id = effective_congregation)
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

-- Recalcula criticidade inicial (backfill aditivo e seguro).
select public.refresh_discipleship_case_criticality(null, null);
