-- Contatos de usuarios (WhatsApp)
create table if not exists public.user_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_contacts enable row level security;

drop policy if exists "user_contacts_read_admin" on public.user_contacts;
drop policy if exists "user_contacts_manage_admin" on public.user_contacts;

create policy "user_contacts_read_admin" on public.user_contacts
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

create policy "user_contacts_manage_admin" on public.user_contacts
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

drop trigger if exists trg_touch_user_contacts on public.user_contacts;
create trigger trg_touch_user_contacts before update on public.user_contacts
for each row execute function public.touch_updated_at();
