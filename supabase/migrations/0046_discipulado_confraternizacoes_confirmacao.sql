-- Discipulado: entidade de confraternizacoes + confirmacao de presenca no case.
-- Mudanca aditiva e retrocompativel.

create table if not exists public.confraternizacoes (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  titulo text not null,
  data_evento timestamptz not null,
  status text not null default 'futura'
    check (status in ('ativa', 'futura', 'encerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.confraternizacoes enable row level security;

drop trigger if exists trg_touch_confraternizacoes on public.confraternizacoes;
create trigger trg_touch_confraternizacoes
before update on public.confraternizacoes
for each row execute function public.touch_updated_at();

create index if not exists confraternizacoes_congregation_status_data_idx
  on public.confraternizacoes (congregation_id, status, data_evento asc);

create unique index if not exists confraternizacoes_congregation_data_uidx
  on public.confraternizacoes (congregation_id, data_evento);

drop policy if exists "confraternizacoes_read" on public.confraternizacoes;
create policy "confraternizacoes_read" on public.confraternizacoes
for select
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
);

drop policy if exists "confraternizacoes_manage" on public.confraternizacoes;
create policy "confraternizacoes_manage" on public.confraternizacoes
for all
using (
  public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'ADMIN_DISCIPULADO'])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
)
with check (
  public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'ADMIN_DISCIPULADO'])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
);

create or replace function public.derive_confraternizacao_status(target_date timestamptz)
returns text
language plpgsql
stable
as $$
begin
  if target_date::date = now()::date then
    return 'ativa';
  end if;
  if target_date > now() then
    return 'futura';
  end if;
  return 'encerrada';
end;
$$;

create or replace function public.apply_confraternizacao_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.status := public.derive_confraternizacao_status(new.data_evento);
  return new;
end;
$$;

drop trigger if exists trg_apply_confraternizacao_status on public.confraternizacoes;
create trigger trg_apply_confraternizacao_status
before insert or update of data_evento on public.confraternizacoes
for each row execute function public.apply_confraternizacao_status();

create or replace function public.sync_confraternizacao_from_calendar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title_value text;
begin
  update public.confraternizacoes
  set status = 'encerrada',
      updated_at = now()
  where congregation_id = new.congregation_id
    and status in ('ativa', 'futura');

  title_value := format('Confraternizacao %s', to_char(new.confraternization_at at time zone 'America/Manaus', 'DD/MM/YYYY'));

  insert into public.confraternizacoes (
    congregation_id,
    titulo,
    data_evento,
    status
  )
  values (
    new.congregation_id,
    title_value,
    new.confraternization_at,
    public.derive_confraternizacao_status(new.confraternization_at)
  )
  on conflict (congregation_id, data_evento)
  do update set
    titulo = excluded.titulo,
    status = excluded.status,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_confraternizacao_from_calendar on public.discipleship_calendar;
create trigger trg_sync_confraternizacao_from_calendar
after insert or update of confraternization_at on public.discipleship_calendar
for each row execute function public.sync_confraternizacao_from_calendar();

insert into public.confraternizacoes (congregation_id, titulo, data_evento, status)
select
  dc.congregation_id,
  format('Confraternizacao %s', to_char(dc.confraternization_at at time zone 'America/Manaus', 'DD/MM/YYYY')) as titulo,
  dc.confraternization_at as data_evento,
  public.derive_confraternizacao_status(dc.confraternization_at) as status
from public.discipleship_calendar dc
on conflict (congregation_id, data_evento)
do update set
  titulo = excluded.titulo,
  status = excluded.status,
  updated_at = now();

alter table public.discipleship_cases
  add column if not exists confraternizacao_id uuid null references public.confraternizacoes(id) on delete set null,
  add column if not exists confraternizacao_confirmada boolean not null default false,
  add column if not exists confraternizacao_confirmada_em timestamptz null;

create index if not exists discipleship_cases_confraternizacao_idx
  on public.discipleship_cases (confraternizacao_id);

create index if not exists discipleship_cases_confraternizacao_confirmada_idx
  on public.discipleship_cases (congregation_id, confraternizacao_confirmada, updated_at desc);

create or replace function public.get_active_confraternizacao(target_congregation_id uuid default null)
returns table (
  id uuid,
  congregation_id uuid,
  titulo text,
  data_evento timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
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

  if effective_congregation is null then
    return;
  end if;

  return query
  select
    c.id,
    c.congregation_id,
    c.titulo,
    c.data_evento,
    c.status
  from public.confraternizacoes c
  where c.congregation_id = effective_congregation
    and c.data_evento::date >= now()::date
  order by c.data_evento asc
  limit 1;
end;
$$;

grant execute on function public.get_active_confraternizacao(uuid) to authenticated;
