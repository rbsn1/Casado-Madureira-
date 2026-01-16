-- Configuração de imagem de fundo do login
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read" on public.app_settings;
drop policy if exists "app_settings_admin_manage" on public.app_settings;

create policy "app_settings_read" on public.app_settings
  for select
  using (true);

create policy "app_settings_admin_manage" on public.app_settings
  for all
  using (public.has_role(array['ADMIN_MASTER']))
  with check (public.has_role(array['ADMIN_MASTER']));

create or replace function public.touch_app_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings before update on public.app_settings
for each row execute function public.touch_app_settings();

-- Bucket público para background do login
insert into storage.buckets (id, name, public)
values ('login-backgrounds', 'login-backgrounds', true)
on conflict (id) do nothing;
