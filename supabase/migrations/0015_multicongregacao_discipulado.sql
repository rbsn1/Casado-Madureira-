-- Multi-congregação + módulo Discipulado (migração aditiva)

-- 1) Congregações e helpers de escopo
create table if not exists public.congregations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.congregations enable row level security;

insert into public.congregations (id, name, slug, is_active)
values ('11111111-1111-1111-1111-111111111111', 'Sede', 'sede', true)
on conflict (slug) do update
set name = excluded.name,
    is_active = excluded.is_active;

alter table public.usuarios_perfis
  add column if not exists congregation_id uuid;

create or replace function public.get_default_congregation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.congregations
  where slug = 'sede'
  limit 1;
$$;

create or replace function public.get_my_congregation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.congregation_id
  from public.usuarios_perfis up
  where up.user_id = auth.uid()
    and up.active is true
    and up.congregation_id is not null
  order by up.created_at asc
  limit 1;
$$;

create or replace function public.current_congregation_id_or_default()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_my_congregation_id(), public.get_default_congregation_id());
$$;

create or replace function public.is_admin_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['ADMIN_MASTER']);
$$;

create or replace function public.get_my_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'roles', coalesce(array_agg(up.role order by up.role), '{}'),
    'congregation_id', public.get_my_congregation_id(),
    'is_admin_master', public.is_admin_master()
  )
  from public.usuarios_perfis up
  where up.user_id = auth.uid()
    and up.active is true;
$$;

grant execute on function public.get_default_congregation_id() to authenticated, anon;
grant execute on function public.get_my_congregation_id() to authenticated;
grant execute on function public.current_congregation_id_or_default() to authenticated, anon;
grant execute on function public.is_admin_master() to authenticated;
grant execute on function public.get_my_context() to authenticated;

drop policy if exists "congregations_read" on public.congregations;
drop policy if exists "congregations_manage_admin" on public.congregations;

create policy "congregations_read" on public.congregations
  for select
  using (
    auth.role() = 'authenticated'
    and (
      public.has_role(array['ADMIN_MASTER'])
      or id = public.get_my_congregation_id()
    )
  );

create policy "congregations_manage_admin" on public.congregations
  for all
  using (public.has_role(array['ADMIN_MASTER']))
  with check (public.has_role(array['ADMIN_MASTER']));

-- 2) Atualiza matriz de roles (inclui CADASTRADOR e DISCIPULADOR)
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.usuarios_perfis'::regclass
      and contype = 'c'
  loop
    execute format('alter table public.usuarios_perfis drop constraint if exists %I', c.conname);
  end loop;
end
$$;

alter table public.usuarios_perfis
  add constraint usuarios_perfis_role_check
  check (
    role in (
      'ADMIN_MASTER',
      'PASTOR',
      'SECRETARIA',
      'NOVOS_CONVERTIDOS',
      'LIDER_DEPTO',
      'VOLUNTARIO',
      'CADASTRADOR',
      'DISCIPULADOR'
    )
  );

-- 3) congregation_id em tabelas existentes de cadastro e módulos relacionados
alter table public.usuarios_perfis
  add column if not exists congregation_id uuid;

alter table public.pessoas
  add column if not exists congregation_id uuid,
  add column if not exists request_id uuid;

alter table public.integracao_novos_convertidos
  add column if not exists congregation_id uuid;

alter table public.batismos
  add column if not exists congregation_id uuid;

alter table public.departamentos
  add column if not exists congregation_id uuid;

alter table public.pessoa_departamento
  add column if not exists congregation_id uuid;

alter table public.eventos_timeline
  add column if not exists congregation_id uuid;

alter table public.weekly_schedule_events
  add column if not exists congregation_id uuid;

alter table public.departamentos_publicos
  add column if not exists congregation_id uuid;

alter table public.departments
  add column if not exists congregation_id uuid;

alter table public.department_roles
  add column if not exists congregation_id uuid;

alter table public.department_contacts
  add column if not exists congregation_id uuid;

alter table public.department_faq
  add column if not exists congregation_id uuid;

-- Backfill seguro
update public.usuarios_perfis
set congregation_id = coalesce(congregation_id, public.get_default_congregation_id())
where congregation_id is null;

update public.pessoas
set congregation_id = coalesce(congregation_id, public.get_default_congregation_id())
where congregation_id is null;

update public.integracao_novos_convertidos i
set congregation_id = coalesce(i.congregation_id, p.congregation_id, public.get_default_congregation_id())
from public.pessoas p
where p.id = i.pessoa_id
  and i.congregation_id is null;

update public.integracao_novos_convertidos
set congregation_id = public.get_default_congregation_id()
where congregation_id is null;

update public.batismos b
set congregation_id = coalesce(b.congregation_id, p.congregation_id, public.get_default_congregation_id())
from public.pessoas p
where p.id = b.pessoa_id
  and b.congregation_id is null;

update public.batismos
set congregation_id = public.get_default_congregation_id()
where congregation_id is null;

update public.departamentos
set congregation_id = coalesce(congregation_id, public.get_default_congregation_id())
where congregation_id is null;

update public.pessoa_departamento pd
set congregation_id = coalesce(pd.congregation_id, p.congregation_id, d.congregation_id, public.get_default_congregation_id())
from public.pessoas p
left join public.departamentos d on d.id = pd.departamento_id
where p.id = pd.pessoa_id
  and pd.congregation_id is null;

update public.pessoa_departamento
set congregation_id = public.get_default_congregation_id()
where congregation_id is null;

update public.eventos_timeline e
set congregation_id = coalesce(e.congregation_id, p.congregation_id, public.get_default_congregation_id())
from public.pessoas p
where p.id = e.pessoa_id
  and e.congregation_id is null;

update public.eventos_timeline
set congregation_id = public.get_default_congregation_id()
where congregation_id is null;

update public.weekly_schedule_events
set congregation_id = coalesce(congregation_id, public.get_default_congregation_id())
where congregation_id is null;

update public.departamentos_publicos
set congregation_id = coalesce(congregation_id, public.get_default_congregation_id())
where congregation_id is null;

update public.departments
set congregation_id = coalesce(congregation_id, public.get_default_congregation_id())
where congregation_id is null;

update public.department_roles r
set congregation_id = coalesce(r.congregation_id, d.congregation_id, public.get_default_congregation_id())
from public.departments d
where d.id = r.department_id
  and r.congregation_id is null;

update public.department_contacts c
set congregation_id = coalesce(c.congregation_id, d.congregation_id, public.get_default_congregation_id())
from public.departments d
where d.id = c.department_id
  and c.congregation_id is null;

update public.department_faq f
set congregation_id = coalesce(f.congregation_id, d.congregation_id, public.get_default_congregation_id())
from public.departments d
where d.id = f.department_id
  and f.congregation_id is null;

-- Defaults e not null
alter table public.usuarios_perfis
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.pessoas
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.integracao_novos_convertidos
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.batismos
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.departamentos
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.pessoa_departamento
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.eventos_timeline
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.weekly_schedule_events
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.departamentos_publicos
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.departments
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.department_roles
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.department_contacts
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

alter table public.department_faq
  alter column congregation_id set default public.current_congregation_id_or_default(),
  alter column congregation_id set not null;

-- FK de integridade (aditivas)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usuarios_perfis_congregation_fk'
  ) then
    alter table public.usuarios_perfis
      add constraint usuarios_perfis_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pessoas_congregation_fk'
  ) then
    alter table public.pessoas
      add constraint pessoas_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'integracao_congregation_fk'
  ) then
    alter table public.integracao_novos_convertidos
      add constraint integracao_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'batismos_congregation_fk'
  ) then
    alter table public.batismos
      add constraint batismos_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'departamentos_congregation_fk'
  ) then
    alter table public.departamentos
      add constraint departamentos_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pessoa_departamento_congregation_fk'
  ) then
    alter table public.pessoa_departamento
      add constraint pessoa_departamento_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'eventos_timeline_congregation_fk'
  ) then
    alter table public.eventos_timeline
      add constraint eventos_timeline_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'weekly_schedule_events_congregation_fk'
  ) then
    alter table public.weekly_schedule_events
      add constraint weekly_schedule_events_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'departamentos_publicos_congregation_fk'
  ) then
    alter table public.departamentos_publicos
      add constraint departamentos_publicos_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'departments_congregation_fk'
  ) then
    alter table public.departments
      add constraint departments_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'department_roles_congregation_fk'
  ) then
    alter table public.department_roles
      add constraint department_roles_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'department_contacts_congregation_fk'
  ) then
    alter table public.department_contacts
      add constraint department_contacts_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'department_faq_congregation_fk'
  ) then
    alter table public.department_faq
      add constraint department_faq_congregation_fk
      foreign key (congregation_id) references public.congregations(id);
  end if;
end
$$;

-- 4) Triggers para manter congregation_id consistente
create or replace function public.sync_congregation_from_pessoa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pessoa_congregation uuid;
begin
  select p.congregation_id into pessoa_congregation
  from public.pessoas p
  where p.id = new.pessoa_id;

  new.congregation_id := coalesce(pessoa_congregation, new.congregation_id, public.current_congregation_id_or_default());
  return new;
end;
$$;

create or replace function public.sync_congregation_from_department()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  dept_congregation uuid;
begin
  select d.congregation_id into dept_congregation
  from public.departments d
  where d.id = new.department_id;

  new.congregation_id := coalesce(dept_congregation, new.congregation_id, public.current_congregation_id_or_default());
  return new;
end;
$$;

drop trigger if exists trg_sync_integracao_congregation on public.integracao_novos_convertidos;
create trigger trg_sync_integracao_congregation
before insert or update on public.integracao_novos_convertidos
for each row execute function public.sync_congregation_from_pessoa();

drop trigger if exists trg_sync_batismos_congregation on public.batismos;
create trigger trg_sync_batismos_congregation
before insert or update on public.batismos
for each row execute function public.sync_congregation_from_pessoa();

drop trigger if exists trg_sync_eventos_congregation on public.eventos_timeline;
create trigger trg_sync_eventos_congregation
before insert or update on public.eventos_timeline
for each row execute function public.sync_congregation_from_pessoa();

drop trigger if exists trg_sync_pessoa_departamento_congregation on public.pessoa_departamento;
create trigger trg_sync_pessoa_departamento_congregation
before insert or update on public.pessoa_departamento
for each row execute function public.sync_congregation_from_pessoa();

drop trigger if exists trg_sync_department_roles_congregation on public.department_roles;
create trigger trg_sync_department_roles_congregation
before insert or update on public.department_roles
for each row execute function public.sync_congregation_from_department();

drop trigger if exists trg_sync_department_contacts_congregation on public.department_contacts;
create trigger trg_sync_department_contacts_congregation
before insert or update on public.department_contacts
for each row execute function public.sync_congregation_from_department();

drop trigger if exists trg_sync_department_faq_congregation on public.department_faq;
create trigger trg_sync_department_faq_congregation
before insert or update on public.department_faq
for each row execute function public.sync_congregation_from_department();

-- Compatibilidade com departamentos legados mantendo congregation_id
create or replace function public.sync_departamentos_from_departments()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    delete from public.departamentos where id = old.id;
    return old;
  end if;

  insert into public.departamentos (id, nome, descricao, responsavel_id, ativo, congregation_id)
  values (new.id, new.name, new.short_description, null, new.is_active, new.congregation_id)
  on conflict (id) do update
  set nome = excluded.nome,
      descricao = excluded.descricao,
      ativo = excluded.ativo,
      congregation_id = excluded.congregation_id;

  return new;
end;
$$;

-- Ajusta automação existente para carregar congregation_id explicitamente
create or replace function public.log_timeline(pessoa uuid, tipo timeline_tipo, descricao text, meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pessoa_congregation uuid;
begin
  select p.congregation_id into pessoa_congregation
  from public.pessoas p
  where p.id = pessoa;

  insert into public.eventos_timeline (pessoa_id, tipo, descricao, metadata, created_by, congregation_id)
  values (pessoa, tipo, descricao, meta, auth.uid(), coalesce(pessoa_congregation, public.current_congregation_id_or_default()));
end;
$$;

create or replace function public.handle_pessoa_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.integracao_novos_convertidos (pessoa_id, status, congregation_id)
  values (new.id, 'PENDENTE', new.congregation_id);

  perform public.log_timeline(new.id, 'CADASTRO', 'Cadastro criado');
  perform public.log_timeline(new.id, 'ENCAMINHADO', 'Encaminhado para fila de novos convertidos');
  return new;
end;
$$;

-- 5) RLS por congregation_id (simples e performático)
-- pessoas
 drop policy if exists "anon_create_pessoas" on public.pessoas;
 drop policy if exists "team_manage_pessoas" on public.pessoas;
 drop policy if exists "pessoas_read" on public.pessoas;
 drop policy if exists "pessoas_manage" on public.pessoas;

create policy "pessoas_read" on public.pessoas
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO','VOLUNTARIO','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "pessoas_manage" on public.pessoas
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "anon_create_pessoas" on public.pessoas
  for insert
  with check (
    auth.role() = 'anon'
    and congregation_id = public.get_default_congregation_id()
  );

-- integracao_novos_convertidos
 drop policy if exists "anon_create_fila" on public.integracao_novos_convertidos;
 drop policy if exists "team_manage_integracao" on public.integracao_novos_convertidos;
 drop policy if exists "integracao_read" on public.integracao_novos_convertidos;
 drop policy if exists "integracao_manage" on public.integracao_novos_convertidos;

create policy "integracao_read" on public.integracao_novos_convertidos
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "integracao_manage" on public.integracao_novos_convertidos
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "anon_create_fila" on public.integracao_novos_convertidos
  for insert
  with check (
    auth.role() = 'anon'
    and congregation_id = public.get_default_congregation_id()
  );

-- batismos
 drop policy if exists "batismos_read" on public.batismos;
 drop policy if exists "batismos_manage" on public.batismos;

create policy "batismos_read" on public.batismos
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "batismos_manage" on public.batismos
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- departamentos
 drop policy if exists "departamentos_read" on public.departamentos;
 drop policy if exists "departamentos_manage" on public.departamentos;

create policy "departamentos_read" on public.departamentos
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','VOLUNTARIO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "departamentos_manage" on public.departamentos
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- pessoa_departamento
 drop policy if exists "pessoa_departamento_read" on public.pessoa_departamento;
 drop policy if exists "pessoa_departamento_manage" on public.pessoa_departamento;

create policy "pessoa_departamento_read" on public.pessoa_departamento
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','VOLUNTARIO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "pessoa_departamento_manage" on public.pessoa_departamento
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- eventos_timeline
 drop policy if exists "timeline_read" on public.eventos_timeline;
 drop policy if exists "timeline_insert" on public.eventos_timeline;

create policy "timeline_read" on public.eventos_timeline
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "timeline_insert" on public.eventos_timeline
  for insert
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- weekly_schedule_events
 drop policy if exists "weekly_schedule_read" on public.weekly_schedule_events;
 drop policy if exists "weekly_schedule_manage" on public.weekly_schedule_events;

create policy "weekly_schedule_read" on public.weekly_schedule_events
  for select
  using (
    (
      auth.role() = 'anon'
      and congregation_id = public.get_default_congregation_id()
    )
    or (
      auth.role() = 'authenticated'
      and (
        public.is_admin_master()
        or congregation_id = public.get_my_congregation_id()
      )
    )
  );

create policy "weekly_schedule_manage" on public.weekly_schedule_events
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- departamentos_publicos
 drop policy if exists "departamentos_publicos_read" on public.departamentos_publicos;
 drop policy if exists "departamentos_publicos_manage" on public.departamentos_publicos;

create policy "departamentos_publicos_read" on public.departamentos_publicos
  for select
  using (
    (
      auth.role() = 'anon'
      and congregation_id = public.get_default_congregation_id()
    )
    or (
      auth.role() = 'authenticated'
      and (
        public.is_admin_master()
        or congregation_id = public.get_my_congregation_id()
      )
    )
  );

create policy "departamentos_publicos_manage" on public.departamentos_publicos
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- novo modelo departments/* (substitui dependência antiga de profiles)
 drop policy if exists "departments_read_public" on public.departments;
 drop policy if exists "departments_manage_admin" on public.departments;
 drop policy if exists "department_roles_read_public" on public.department_roles;
 drop policy if exists "department_roles_manage_admin" on public.department_roles;
 drop policy if exists "department_contacts_read_public" on public.department_contacts;
 drop policy if exists "department_contacts_manage_admin" on public.department_contacts;
 drop policy if exists "department_faq_read_public" on public.department_faq;
 drop policy if exists "department_faq_manage_admin" on public.department_faq;

create policy "departments_read_public" on public.departments
  for select
  using (
    is_active = true
    and (
      public.is_admin_master()
      or (
        auth.role() = 'authenticated'
        and congregation_id = public.get_my_congregation_id()
      )
      or (
        auth.role() = 'anon'
        and congregation_id = public.get_default_congregation_id()
      )
    )
  );

create policy "departments_manage_admin" on public.departments
  for all
  using (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "department_roles_read_public" on public.department_roles
  for select
  using (
    is_active = true
    and (
      public.is_admin_master()
      or (
        auth.role() = 'authenticated'
        and congregation_id = public.get_my_congregation_id()
      )
      or (
        auth.role() = 'anon'
        and congregation_id = public.get_default_congregation_id()
      )
    )
  );

create policy "department_roles_manage_admin" on public.department_roles
  for all
  using (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "department_contacts_read_public" on public.department_contacts
  for select
  using (
    is_active = true
    and (
      public.is_admin_master()
      or (
        auth.role() = 'authenticated'
        and congregation_id = public.get_my_congregation_id()
      )
      or (
        auth.role() = 'anon'
        and congregation_id = public.get_default_congregation_id()
      )
    )
  );

create policy "department_contacts_manage_admin" on public.department_contacts
  for all
  using (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "department_faq_read_public" on public.department_faq
  for select
  using (
    is_active = true
    and (
      public.is_admin_master()
      or (
        auth.role() = 'authenticated'
        and congregation_id = public.get_my_congregation_id()
      )
      or (
        auth.role() = 'anon'
        and congregation_id = public.get_default_congregation_id()
      )
    )
  );

create policy "department_faq_manage_admin" on public.department_faq
  for all
  using (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','SECRETARIA','LIDER_DEPTO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 6) Performance, deduplicação e idempotência (cadastro)
create index if not exists usuarios_perfis_congregation_idx
  on public.usuarios_perfis (congregation_id);

create index if not exists pessoas_congregation_created_idx
  on public.pessoas (congregation_id, created_at desc);

create index if not exists pessoas_congregation_phone_idx
  on public.pessoas (congregation_id, telefone_whatsapp);

create index if not exists integracao_congregation_created_idx
  on public.integracao_novos_convertidos (congregation_id, created_at desc);

create index if not exists integracao_congregation_status_idx
  on public.integracao_novos_convertidos (congregation_id, status);

create index if not exists batismos_congregation_created_idx
  on public.batismos (congregation_id, created_at desc);

create index if not exists pessoa_departamento_congregation_created_idx
  on public.pessoa_departamento (congregation_id, created_at desc);

create index if not exists eventos_timeline_congregation_created_idx
  on public.eventos_timeline (congregation_id, created_at desc);

create unique index if not exists pessoas_request_id_uidx
  on public.pessoas (request_id)
  where request_id is not null;

-- Evita falha da migração caso já existam telefones duplicados em produção.
do $$
begin
  if not exists (
    select 1
    from public.pessoas p
    where p.telefone_whatsapp is not null
      and btrim(p.telefone_whatsapp) <> ''
    group by p.congregation_id, p.telefone_whatsapp
    having count(*) > 1
  ) then
    execute 'create unique index if not exists pessoas_congregation_phone_uidx on public.pessoas (congregation_id, telefone_whatsapp) where telefone_whatsapp is not null and btrim(telefone_whatsapp) <> ''''';
  else
    raise warning 'Não foi possível aplicar unique(congregation_id, telefone_whatsapp) por dados duplicados existentes. A regra seguirá validada por trigger para novos registros.';
  end if;
end
$$;

create or replace function public.prevent_duplicate_phone_per_congregation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.telefone_whatsapp is null or btrim(new.telefone_whatsapp) = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.pessoas p
    where p.congregation_id = new.congregation_id
      and p.telefone_whatsapp = new.telefone_whatsapp
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'Já existe cadastro com este telefone nesta congregação.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_phone_per_congregation on public.pessoas;
create trigger trg_prevent_duplicate_phone_per_congregation
before insert or update of telefone_whatsapp, congregation_id on public.pessoas
for each row execute function public.prevent_duplicate_phone_per_congregation();

-- 7) Dashboard existente com escopo por congregação (admin pode filtrar)
drop function if exists public.get_casados_dashboard(timestamptz, timestamptz, int);

create or replace function public.get_casados_dashboard(
  start_ts timestamptz default null,
  end_ts timestamptz default null,
  year int default null,
  target_congregation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_prev timestamptz;
  end_prev timestamptz;
  result jsonb;
  target_year int := coalesce(year, extract(year from now())::int);
  effective_congregation uuid;
begin
  if not public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  if start_ts is not null and end_ts is not null then
    start_prev := start_ts - (end_ts - start_ts);
    end_prev := start_ts;
  end if;

  select jsonb_build_object(
    'total',
    (
      select count(*)
      from public.pessoas p
      where (effective_congregation is null or p.congregation_id = effective_congregation)
        and (start_ts is null or p.created_at >= start_ts)
        and (end_ts is null or p.created_at <= end_ts)
    ),
    'origem',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', origem, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select
          case
            when p.origem ilike '%manh%' then 'Manhã'
            when p.origem ilike '%noite%' then 'Noite'
            when p.origem ilike '%evento%' then 'Evento'
            when p.origem ilike '%celula%' or p.origem ilike '%célula%' then 'Célula'
            else 'Outro'
          end as origem,
          count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and (start_ts is null or p.created_at >= start_ts)
          and (end_ts is null or p.created_at <= end_ts)
        group by origem
        order by total desc
      ) dados
    ),
    'igrejas',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', igreja, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select coalesce(p.igreja_origem, 'Sem igreja') as igreja, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and (start_ts is null or p.created_at >= start_ts)
          and (end_ts is null or p.created_at <= end_ts)
        group by igreja
        order by total desc
        limit 6
      ) dados
    ),
    'bairros',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', bairro, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select coalesce(p.bairro, 'Sem bairro') as bairro, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and (start_ts is null or p.created_at >= start_ts)
          and (end_ts is null or p.created_at <= end_ts)
        group by bairro
        order by total desc
        limit 6
      ) dados
    ),
    'crescimento_bairros',
    (
      case
        when start_prev is null or end_prev is null then '[]'::jsonb
        else (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'label', curr.label,
              'current', curr.total,
              'previous', coalesce(prev.total, 0),
              'delta', curr.total - coalesce(prev.total, 0),
              'delta_pct', case
                when coalesce(prev.total, 0) = 0 then null
                else round(((curr.total - prev.total)::numeric / prev.total) * 100, 1)
              end
            )
            order by curr.total desc
          ), '[]'::jsonb)
          from (
            select coalesce(p.bairro, 'Sem bairro') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and p.created_at >= start_ts
              and p.created_at <= end_ts
            group by label
            order by total desc
            limit 6
          ) curr
          left join (
            select coalesce(p.bairro, 'Sem bairro') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and p.created_at >= start_prev
              and p.created_at <= end_prev
            group by label
          ) prev
          using (label)
        )
      end
    ),
    'crescimento_igrejas',
    (
      case
        when start_prev is null or end_prev is null then '[]'::jsonb
        else (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'label', curr.label,
              'current', curr.total,
              'previous', coalesce(prev.total, 0),
              'delta', curr.total - coalesce(prev.total, 0),
              'delta_pct', case
                when coalesce(prev.total, 0) = 0 then null
                else round(((curr.total - prev.total)::numeric / prev.total) * 100, 1)
              end
            )
            order by curr.total desc
          ), '[]'::jsonb)
          from (
            select coalesce(p.igreja_origem, 'Sem igreja') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and p.created_at >= start_ts
              and p.created_at <= end_ts
            group by label
            order by total desc
            limit 6
          ) curr
          left join (
            select coalesce(p.igreja_origem, 'Sem igreja') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and p.created_at >= start_prev
              and p.created_at <= end_prev
            group by label
          ) prev
          using (label)
        )
      end
    ),
    'anos_disponiveis',
    (
      select coalesce(jsonb_agg(ano order by ano desc), '[]'::jsonb)
      from (
        select distinct extract(year from p.created_at)::int as ano
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
      ) anos
    ),
    'cadastros_mensais',
    (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', coalesce(t.total, 0)) order by m), '[]'::jsonb)
      from generate_series(1, 12) as m
      left join (
        select extract(month from p.created_at)::int as mes, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and extract(year from p.created_at)::int = target_year
        group by mes
      ) t on t.mes = m
    ),
    'ano_selecionado', target_year
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_casados_dashboard(timestamptz, timestamptz, int, uuid) to authenticated;

drop function if exists public.get_novos_dashboard(timestamptz, timestamptz, int);

create or replace function public.get_novos_dashboard(
  start_ts timestamptz default null,
  end_ts timestamptz default null,
  year int default null,
  target_congregation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  target_year int := coalesce(year, extract(year from now())::int);
  effective_congregation uuid;
begin
  if not public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  select jsonb_build_object(
    'funnel',
    (
      select jsonb_build_array(
        jsonb_build_object('label','Cadastros recebidos','value',(
          select count(*) from public.pessoas p
          where (effective_congregation is null or p.congregation_id = effective_congregation)
            and (start_ts is null or p.created_at >= start_ts)
            and (end_ts is null or p.created_at <= end_ts)
        )),
        jsonb_build_object('label','Encaminhados','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'PENDENTE'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Contato iniciado','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'CONTATO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Acompanhamento','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'EM_ANDAMENTO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Integrados','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'INTEGRADO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Batizados','value',(
          select count(*) from public.batismos b
          where (effective_congregation is null or b.congregation_id = effective_congregation)
            and (start_ts is null or b.data >= start_ts::date)
            and (end_ts is null or b.data <= end_ts::date)
        ))
      )
    ),
    'voluntariado',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', depto, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select d.nome as depto, count(pd.id) as total
        from public.departamentos d
        left join public.pessoa_departamento pd
          on pd.departamento_id = d.id
         and coalesce(pd.status,'ATIVO') <> 'INATIVO'
        where (effective_congregation is null or d.congregation_id = effective_congregation)
          and d.ativo is true
        group by d.nome
        order by total desc
        limit 6
      ) dados
    ),
    'destaques',
    jsonb_build_object(
      'contatos_7d', (
        select count(*)
        from public.eventos_timeline e
        where (effective_congregation is null or e.congregation_id = effective_congregation)
          and e.tipo = 'CONTATO'
          and e.created_at >= now() - interval '7 days'
      ),
      'departamentos_ativos', (
        select count(*)
        from public.departamentos d
        where (effective_congregation is null or d.congregation_id = effective_congregation)
          and d.ativo is true
      ),
      'batismos_30d', (
        select count(*)
        from public.batismos b
        where (effective_congregation is null or b.congregation_id = effective_congregation)
          and b.data >= current_date
          and b.data <= current_date + interval '30 days'
      )
    ),
    'pendencias',
    jsonb_build_object(
      'pendente_7d', (
        select count(*)
        from public.integracao_novos_convertidos i
        where (effective_congregation is null or i.congregation_id = effective_congregation)
          and i.status in ('PENDENTE','CONTATO')
          and coalesce(i.ultima_interacao, i.created_at) < now() - interval '7 days'
      ),
      'pendente_14d', (
        select count(*)
        from public.integracao_novos_convertidos i
        where (effective_congregation is null or i.congregation_id = effective_congregation)
          and i.status in ('PENDENTE','CONTATO')
          and coalesce(i.ultima_interacao, i.created_at) < now() - interval '14 days'
      )
    ),
    'anos_disponiveis',
    (
      select coalesce(jsonb_agg(ano order by ano desc), '[]'::jsonb)
      from (
        select distinct extract(year from p.created_at)::int as ano
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
      ) anos
    ),
    'cadastros_mensais',
    (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', coalesce(t.total, 0)) order by m), '[]'::jsonb)
      from generate_series(1, 12) as m
      left join (
        select extract(month from p.created_at)::int as mes, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and extract(year from p.created_at)::int = target_year
        group by mes
      ) t on t.mes = m
    ),
    'ano_selecionado', target_year
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_novos_dashboard(timestamptz, timestamptz, int, uuid) to authenticated;

-- 8) Modelagem Discipulado (aditiva)
create table if not exists public.discipleship_cases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.pessoas(id) on delete restrict,
  congregation_id uuid not null references public.congregations(id),
  status text not null default 'em_discipulado' check (status in ('em_discipulado','concluido','pausado')),
  assigned_to uuid null references auth.users(id) on delete set null,
  notes text null,
  request_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discipleship_modules (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id),
  title text not null,
  description text null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discipleship_progress (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipleship_cases(id) on delete cascade,
  module_id uuid not null references public.discipleship_modules(id) on delete restrict,
  congregation_id uuid not null references public.congregations(id),
  status text not null default 'nao_iniciado' check (status in ('nao_iniciado','em_andamento','concluido')),
  completed_at timestamptz null,
  completed_by uuid null references auth.users(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, module_id)
);

alter table public.discipleship_cases enable row level security;
alter table public.discipleship_modules enable row level security;
alter table public.discipleship_progress enable row level security;

-- Índices obrigatórios de pico
create index if not exists discipleship_cases_congregation_created_idx
  on public.discipleship_cases (congregation_id, created_at desc);

create index if not exists discipleship_cases_congregation_status_idx
  on public.discipleship_cases (congregation_id, status);

create index if not exists discipleship_cases_member_idx
  on public.discipleship_cases (member_id);

create index if not exists discipleship_progress_case_idx
  on public.discipleship_progress (case_id);

create index if not exists discipleship_progress_congregation_status_idx
  on public.discipleship_progress (congregation_id, status);

create unique index if not exists discipleship_cases_active_member_uidx
  on public.discipleship_cases (member_id)
  where status in ('em_discipulado', 'pausado');

create unique index if not exists discipleship_cases_request_id_uidx
  on public.discipleship_cases (request_id)
  where request_id is not null;

create unique index if not exists discipleship_modules_congregation_title_uidx
  on public.discipleship_modules (congregation_id, title);

-- Triggers de updated_at
 drop trigger if exists trg_touch_discipleship_cases on public.discipleship_cases;
create trigger trg_touch_discipleship_cases before update on public.discipleship_cases
for each row execute function public.touch_updated_at();

 drop trigger if exists trg_touch_discipleship_modules on public.discipleship_modules;
create trigger trg_touch_discipleship_modules before update on public.discipleship_modules
for each row execute function public.touch_updated_at();

 drop trigger if exists trg_touch_discipleship_progress on public.discipleship_progress;
create trigger trg_touch_discipleship_progress before update on public.discipleship_progress
for each row execute function public.touch_updated_at();

-- Automação: abrir progresso de todos os módulos ativos ao criar case
create or replace function public.handle_discipleship_case_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.discipleship_progress (case_id, module_id, congregation_id, status)
  select new.id, m.id, new.congregation_id, 'nao_iniciado'
  from public.discipleship_modules m
  where m.congregation_id = new.congregation_id
    and m.is_active is true;

  return new;
end;
$$;

 drop trigger if exists trg_discipleship_case_insert on public.discipleship_cases;
create trigger trg_discipleship_case_insert
after insert on public.discipleship_cases
for each row execute function public.handle_discipleship_case_insert();

-- Mantém progresso/case na mesma congregação
create or replace function public.sync_discipleship_progress_congregation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  case_congregation uuid;
  module_congregation uuid;
begin
  select c.congregation_id into case_congregation
  from public.discipleship_cases c
  where c.id = new.case_id;

  select m.congregation_id into module_congregation
  from public.discipleship_modules m
  where m.id = new.module_id;

  if case_congregation is null or module_congregation is null then
    raise exception 'Case ou módulo inválido para progresso.';
  end if;

  if case_congregation <> module_congregation then
    raise exception 'Case e módulo precisam pertencer à mesma congregação.';
  end if;

  new.congregation_id := case_congregation;
  return new;
end;
$$;

 drop trigger if exists trg_sync_discipleship_progress_congregation on public.discipleship_progress;
create trigger trg_sync_discipleship_progress_congregation
before insert or update on public.discipleship_progress
for each row execute function public.sync_discipleship_progress_congregation();

-- Regras de conclusão do case
create or replace function public.enforce_discipleship_case_conclusion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluido' and old.status <> 'concluido' then
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

create or replace function public.touch_case_from_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discipleship_cases
  set updated_at = now()
  where id = new.case_id;

  return new;
end;
$$;

 drop trigger if exists trg_touch_case_from_progress on public.discipleship_progress;
create trigger trg_touch_case_from_progress
after insert or update on public.discipleship_progress
for each row execute function public.touch_case_from_progress();

-- Policies Discipulado
 drop policy if exists "discipleship_cases_read" on public.discipleship_cases;
 drop policy if exists "discipleship_cases_manage" on public.discipleship_cases;
 drop policy if exists "discipleship_modules_read" on public.discipleship_modules;
 drop policy if exists "discipleship_modules_manage" on public.discipleship_modules;
 drop policy if exists "discipleship_progress_read" on public.discipleship_progress;
 drop policy if exists "discipleship_progress_manage" on public.discipleship_progress;

create policy "discipleship_cases_read" on public.discipleship_cases
  for select
  using (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_cases_manage" on public.discipleship_cases
  for all
  using (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_modules_read" on public.discipleship_modules
  for select
  using (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_modules_manage" on public.discipleship_modules
  for all
  using (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_progress_read" on public.discipleship_progress
  for select
  using (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "discipleship_progress_manage" on public.discipleship_progress
  for all
  using (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 9) Elegibilidade para departamentos
create or replace function public.is_member_department_eligible(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.discipleship_cases dc
    where dc.member_id = target_member_id
      and dc.status = 'concluido'
  );
$$;

grant execute on function public.is_member_department_eligible(uuid) to authenticated;

create or replace function public.enforce_department_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.status, 'ATIVO') <> 'INATIVO' then
    if not public.is_member_department_eligible(new.pessoa_id) then
      raise exception 'Para participar de departamentos, conclua o discipulado.';
    end if;
  end if;
  return new;
end;
$$;

 drop trigger if exists trg_enforce_department_eligibility on public.pessoa_departamento;
create trigger trg_enforce_department_eligibility
before insert or update of pessoa_id, status on public.pessoa_departamento
for each row execute function public.enforce_department_eligibility();

-- 10) Dashboard do Discipulado
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
  if not public.has_role(array['ADMIN_MASTER','DISCIPULADOR']) then
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

-- 11) Seed inicial de módulos (congregação sede)
insert into public.discipleship_modules (congregation_id, title, description, sort_order, is_active)
values
  (public.get_default_congregation_id(), 'Fundamentos da Fé', 'Base bíblica e doutrinária para novos convertidos.', 1, true),
  (public.get_default_congregation_id(), 'Vida Devocional', 'Prática de oração, leitura bíblica e disciplina espiritual.', 2, true),
  (public.get_default_congregation_id(), 'Comunhão e Serviço', 'Integração saudável na igreja local e cultura de serviço.', 3, true),
  (public.get_default_congregation_id(), 'Visão e Missão', 'Compreensão da visão da igreja e responsabilidade missionária.', 4, true)
on conflict (congregation_id, title) do nothing;
