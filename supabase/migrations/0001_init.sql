-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'integracao_status') then
    create type integracao_status as enum ('PENDENTE', 'EM_ANDAMENTO', 'CONTATO', 'INTEGRADO', 'BATIZADO');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'timeline_tipo') then
    create type timeline_tipo as enum ('CADASTRO', 'ENCAMINHADO', 'CONTATO', 'INTEGRADO', 'BATISMO', 'DEPTO_VINCULO');
  end if;
end$$;

-- Tabelas
create table if not exists public.usuarios_perfis (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO','VOLUNTARIO')),
  active boolean default true,
  created_at timestamptz default now(),
  primary key (user_id, role)
);

create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  telefone_whatsapp text,
  origem text,
  data date,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.integracao_novos_convertidos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  status integracao_status default 'PENDENTE',
  responsavel_id uuid references auth.users(id),
  notas text,
  ultima_interacao timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.batismos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  data date not null,
  local text,
  responsavel_id uuid references auth.users(id),
  observacoes text,
  created_at timestamptz default now()
);

create table if not exists public.departamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  responsavel_id uuid references auth.users(id),
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pessoa_departamento (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  funcao text,
  status text default 'ATIVO',
  desde date default now(),
  created_at timestamptz default now()
);

create table if not exists public.eventos_timeline (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  tipo timeline_tipo not null,
  descricao text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- View auxiliar
create or replace view public.auth_users_with_role as
select user_id, role, active
from public.usuarios_perfis
where active is true;

-- Função: checar role
create or replace function public.has_role(target_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.usuarios_perfis up
    where up.user_id = auth.uid()
      and up.active
      and up.role = any(target_roles)
  );
$$;

-- Função: registrar evento na timeline
create or replace function public.log_timeline(pessoa uuid, tipo timeline_tipo, descricao text, meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.eventos_timeline (pessoa_id, tipo, descricao, metadata, created_by)
  values (pessoa, tipo, descricao, meta, auth.uid());
end;
$$;

-- Função: pós-inserção de pessoas (cria fila + timeline)
create or replace function public.handle_pessoa_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.integracao_novos_convertidos (pessoa_id, status)
  values (new.id, 'PENDENTE');

  perform public.log_timeline(new.id, 'CADASTRO', 'Cadastro criado');
  perform public.log_timeline(new.id, 'ENCAMINHADO', 'Encaminhado para fila de novos convertidos');
  return new;
end;
$$;

-- Função: atualizar timeline ao mudar status da integração
create or replace function public.handle_integracao_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  descricao text;
begin
  if new.status is distinct from old.status then
    descricao := format('Status atualizado para %s', new.status);
    perform public.log_timeline(new.pessoa_id, 'CONTATO', descricao, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;

-- Função: evento de batismo
create or replace function public.handle_batismo_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_timeline(new.pessoa_id, 'BATISMO', 'Batismo registrado', jsonb_build_object('data', new.data, 'local', new.local));
  return new;
end;
$$;

-- Função: evento de vínculo em departamento
create or replace function public.handle_pessoa_departamento_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_timeline(new.pessoa_id, 'DEPTO_VINCULO', 'Vínculo em departamento', jsonb_build_object('departamento', new.departamento_id, 'funcao', new.funcao));
  return new;
end;
$$;

-- Triggers
drop trigger if exists trg_pessoa_insert on public.pessoas;
create trigger trg_pessoa_insert
after insert on public.pessoas
for each row execute function public.handle_pessoa_insert();

drop trigger if exists trg_integracao_update on public.integracao_novos_convertidos;
create trigger trg_integracao_update
after update on public.integracao_novos_convertidos
for each row execute function public.handle_integracao_update();

drop trigger if exists trg_batismo_insert on public.batismos;
create trigger trg_batismo_insert
after insert on public.batismos
for each row execute function public.handle_batismo_insert();

drop trigger if exists trg_pessoa_departamento_insert on public.pessoa_departamento;
create trigger trg_pessoa_departamento_insert
after insert on public.pessoa_departamento
for each row execute function public.handle_pessoa_departamento_insert();

-- RLS
alter table public.usuarios_perfis enable row level security;
alter table public.pessoas enable row level security;
alter table public.integracao_novos_convertidos enable row level security;
alter table public.batismos enable row level security;
alter table public.departamentos enable row level security;
alter table public.pessoa_departamento enable row level security;
alter table public.eventos_timeline enable row level security;

-- Policies: usuarios_perfis
create policy "admin_manage_roles" on public.usuarios_perfis
  for all
  using (public.has_role(array['ADMIN_MASTER']))
  with check (public.has_role(array['ADMIN_MASTER']));

-- Policies: pessoas
create policy "anon_create_pessoas" on public.pessoas
  for insert
  with check (auth.role() = 'anon');

create policy "team_manage_pessoas" on public.pessoas
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']));

-- Policies: integracao_novos_convertidos
create policy "anon_create_fila" on public.integracao_novos_convertidos
  for insert
  with check (auth.role() = 'anon');

create policy "team_manage_integracao" on public.integracao_novos_convertidos
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']));

-- Policies: batismos
create policy "batismos_read" on public.batismos
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

create policy "batismos_manage" on public.batismos
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

-- Policies: departamentos
create policy "departamentos_read" on public.departamentos
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','VOLUNTARIO']));

create policy "departamentos_manage" on public.departamentos
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']));

-- Policies: pessoa_departamento
create policy "pessoa_departamento_read" on public.pessoa_departamento
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']));

create policy "pessoa_departamento_manage" on public.pessoa_departamento
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']));

-- Policies: eventos_timeline
create policy "timeline_read" on public.eventos_timeline
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']));

create policy "timeline_insert" on public.eventos_timeline
  for insert
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']));

-- Garantir update de timestamps
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_pessoas on public.pessoas;
create trigger trg_touch_pessoas before update on public.pessoas
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_integracao on public.integracao_novos_convertidos;
create trigger trg_touch_integracao before update on public.integracao_novos_convertidos
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_departamentos on public.departamentos;
create trigger trg_touch_departamentos before update on public.departamentos
for each row execute function public.touch_updated_at();
