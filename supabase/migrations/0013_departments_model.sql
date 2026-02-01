-- Departments data model (governance for portal and chat)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'department_type') then
    create type department_type as enum ('simple', 'colegiado', 'umbrella', 'mixed');
  end if;
  if not exists (select 1 from pg_type where typname = 'department_faq_intent') then
    create type department_faq_intent as enum ('about', 'contact', 'schedule', 'participate', 'location');
  end if;
end$$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type department_type not null default 'simple',
  parent_id uuid references public.departments(id) on delete set null,
  short_description text,
  long_description text,
  location text,
  meeting_info text,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.department_roles (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  role_name text not null,
  role_key text not null,
  role_priority int default 0,
  is_public boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.department_contacts (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  role_id uuid references public.department_roles(id) on delete set null,
  display_name text not null,
  whatsapp text,
  phone text,
  email text,
  availability text,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.department_faq (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  intent department_faq_intent not null,
  answer_title text not null,
  answer_body text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.departments enable row level security;
alter table public.department_roles enable row level security;
alter table public.department_contacts enable row level security;
alter table public.department_faq enable row level security;

drop policy if exists "departments_read_public" on public.departments;
drop policy if exists "departments_manage_admin" on public.departments;
drop policy if exists "department_roles_read_public" on public.department_roles;
drop policy if exists "department_roles_manage_admin" on public.department_roles;
drop policy if exists "department_contacts_read_public" on public.department_contacts;
drop policy if exists "department_contacts_manage_admin" on public.department_contacts;
drop policy if exists "department_faq_read_public" on public.department_faq;
drop policy if exists "department_faq_manage_admin" on public.department_faq;

create policy "departments_read_public" on public.departments
  for select using (is_active = true);

create policy "departments_manage_admin" on public.departments
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "department_roles_read_public" on public.department_roles
  for select using (is_active = true);

create policy "department_roles_manage_admin" on public.department_roles
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "department_contacts_read_public" on public.department_contacts
  for select using (is_active = true);

create policy "department_contacts_manage_admin" on public.department_contacts
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "department_faq_read_public" on public.department_faq
  for select using (is_active = true);

create policy "department_faq_manage_admin" on public.department_faq
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop trigger if exists trg_touch_departments on public.departments;
create trigger trg_touch_departments before update on public.departments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_department_roles on public.department_roles;
create trigger trg_touch_department_roles before update on public.department_roles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_department_contacts on public.department_contacts;
create trigger trg_touch_department_contacts before update on public.department_contacts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_department_faq on public.department_faq;
create trigger trg_touch_department_faq before update on public.department_faq
for each row execute function public.touch_updated_at();

create index if not exists departments_active_idx on public.departments (is_active);
create index if not exists departments_parent_idx on public.departments (parent_id);
create index if not exists department_roles_dept_idx on public.department_roles (department_id);
create index if not exists department_contacts_dept_idx on public.department_contacts (department_id);
create index if not exists department_faq_dept_idx on public.department_faq (department_id);

-- Compatibilidade com modulo interno existente (departamentos)
create or replace function public.sync_departamentos_from_departments()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    delete from public.departamentos where id = old.id;
    return old;
  end if;

  insert into public.departamentos (id, nome, descricao, responsavel_id, ativo)
  values (new.id, new.name, new.short_description, null, new.is_active)
  on conflict (id) do update
  set nome = excluded.nome,
      descricao = excluded.descricao,
      ativo = excluded.ativo;

  return new;
end;
$$;

drop trigger if exists trg_sync_departamentos on public.departments;
create trigger trg_sync_departamentos
after insert or update or delete on public.departments
for each row execute function public.sync_departamentos_from_departments();
