-- WhatsApp Cloud API: configurações por tenant, contatos e fila de mensagens.

create table if not exists public.church_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.congregations(id) on delete cascade,
  whatsapp_group_link text,
  welcome_template_name text not null default 'welcome_ccm',
  welcome_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.congregations(id) on delete cascade,
  name text not null,
  phone_e164 text not null check (phone_e164 ~ '^[0-9]{8,15}$'),
  opt_in_whatsapp boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.congregations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  type text not null default 'welcome' check (type in ('welcome')),
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'ENVIADO', 'ERRO')),
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_jobs_status_scheduled_at_idx
  on public.message_jobs (status, scheduled_at);

create index if not exists contacts_tenant_created_at_idx
  on public.contacts (tenant_id, created_at desc);

create index if not exists message_jobs_tenant_created_at_idx
  on public.message_jobs (tenant_id, created_at desc);

create or replace function public.can_manage_whatsapp_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'SECRETARIA'])
    and public.is_congregation_active(target_tenant_id)
    and (
      public.is_admin_master()
      or public.has_role(array['SUPER_ADMIN'])
      or target_tenant_id = public.get_my_congregation_id()
    );
$$;

grant execute on function public.can_manage_whatsapp_tenant(uuid) to authenticated;

create or replace function public.can_manage_whatsapp_contacts(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'SECRETARIA', 'NOVOS_CONVERTIDOS', 'CADASTRADOR'])
    and public.is_congregation_active(target_tenant_id)
    and (
      public.is_admin_master()
      or public.has_role(array['SUPER_ADMIN'])
      or target_tenant_id = public.get_my_congregation_id()
    );
$$;

grant execute on function public.can_manage_whatsapp_contacts(uuid) to authenticated;

alter table public.church_settings enable row level security;
alter table public.contacts enable row level security;
alter table public.message_jobs enable row level security;

drop trigger if exists trg_church_settings_touch_updated_at on public.church_settings;
create trigger trg_church_settings_touch_updated_at
before update on public.church_settings
for each row execute function public.touch_updated_at();

drop trigger if exists trg_contacts_touch_updated_at on public.contacts;
create trigger trg_contacts_touch_updated_at
before update on public.contacts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_message_jobs_touch_updated_at on public.message_jobs;
create trigger trg_message_jobs_touch_updated_at
before update on public.message_jobs
for each row execute function public.touch_updated_at();

drop policy if exists "church_settings_read" on public.church_settings;
create policy "church_settings_read" on public.church_settings
for select
using (public.can_manage_whatsapp_tenant(tenant_id));

drop policy if exists "church_settings_manage" on public.church_settings;
create policy "church_settings_manage" on public.church_settings
for all
using (public.can_manage_whatsapp_tenant(tenant_id))
with check (public.can_manage_whatsapp_tenant(tenant_id));

drop policy if exists "contacts_read" on public.contacts;
create policy "contacts_read" on public.contacts
for select
using (public.can_manage_whatsapp_contacts(tenant_id));

drop policy if exists "contacts_manage" on public.contacts;
create policy "contacts_manage" on public.contacts
for all
using (public.can_manage_whatsapp_contacts(tenant_id))
with check (public.can_manage_whatsapp_contacts(tenant_id));

drop policy if exists "message_jobs_read" on public.message_jobs;
create policy "message_jobs_read" on public.message_jobs
for select
using (public.can_manage_whatsapp_tenant(tenant_id));

drop policy if exists "message_jobs_insert" on public.message_jobs;
create policy "message_jobs_insert" on public.message_jobs
for insert
with check (public.can_manage_whatsapp_tenant(tenant_id));
