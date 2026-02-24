-- Discipulado: configuracao da turma por turno (modulo e data de inicio).

create table if not exists public.discipleship_turma_settings (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  turno text not null check (turno in ('MANHA', 'TARDE', 'NOITE', 'NAO_INFORMADO')),
  module_id uuid null references public.discipleship_modules(id) on delete set null,
  start_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists discipleship_turma_settings_congregation_turno_uidx
  on public.discipleship_turma_settings (congregation_id, turno);

create index if not exists discipleship_turma_settings_congregation_idx
  on public.discipleship_turma_settings (congregation_id, turno);

create index if not exists discipleship_turma_settings_module_idx
  on public.discipleship_turma_settings (module_id);

alter table public.discipleship_turma_settings enable row level security;

drop trigger if exists trg_touch_discipleship_turma_settings on public.discipleship_turma_settings;
create trigger trg_touch_discipleship_turma_settings
before update on public.discipleship_turma_settings
for each row execute function public.touch_updated_at();

drop policy if exists "discipleship_turma_settings_read" on public.discipleship_turma_settings;
create policy "discipleship_turma_settings_read" on public.discipleship_turma_settings
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

drop policy if exists "discipleship_turma_settings_manage" on public.discipleship_turma_settings;
create policy "discipleship_turma_settings_manage" on public.discipleship_turma_settings
for all
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
)
with check (
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

