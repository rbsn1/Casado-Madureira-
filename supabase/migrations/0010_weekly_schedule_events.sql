-- Tabela de agenda semanal (portal CCM)
create table if not exists public.weekly_schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  location text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.weekly_schedule_events enable row level security;

-- Policies
drop policy if exists "weekly_schedule_read" on public.weekly_schedule_events;
drop policy if exists "weekly_schedule_manage" on public.weekly_schedule_events;

create policy "weekly_schedule_read" on public.weekly_schedule_events
  for select
  using (true);

create policy "weekly_schedule_manage" on public.weekly_schedule_events
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

-- Trigger para updated_at
drop trigger if exists trg_touch_weekly_schedule_events on public.weekly_schedule_events;
create trigger trg_touch_weekly_schedule_events before update on public.weekly_schedule_events
for each row execute function public.touch_updated_at();

-- Índices
create index if not exists weekly_schedule_events_active_idx
  on public.weekly_schedule_events (is_active);
create index if not exists weekly_schedule_events_order_idx
  on public.weekly_schedule_events (weekday, start_time);
