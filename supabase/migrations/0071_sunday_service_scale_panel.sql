-- Painel de Escala - Cultos de Domingo
-- Escalas vinculadas apenas a usuarios ja existentes no portal CCM.

create table if not exists public.escalas_domingo (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  culto text not null check (culto in ('DOMINGO_MANHA', 'DOMINGO_NOITE')),
  data date not null,
  horario time not null,
  criado_por uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escalas_domingo_usuarios (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references public.escalas_domingo(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  status_presenca text not null default 'pendente'
    check (status_presenca in ('pendente', 'confirmado', 'nao_podera_ir')),
  respondido_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint escalas_domingo_usuarios_unique unique (escala_id, usuario_id)
);

create index if not exists escalas_domingo_congregation_data_idx
  on public.escalas_domingo (congregation_id, data desc, horario asc);

create index if not exists escalas_domingo_usuarios_user_idx
  on public.escalas_domingo_usuarios (usuario_id, status_presenca, respondido_em desc);

create index if not exists escalas_domingo_usuarios_congregation_idx
  on public.escalas_domingo_usuarios (congregation_id, status_presenca);

alter table public.escalas_domingo enable row level security;
alter table public.escalas_domingo_usuarios enable row level security;

create or replace function public.normalize_escala_domingo_culto(value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text := upper(regexp_replace(coalesce(value, ''), '[^A-Z0-9]+', '_', 'g'));
begin
  if normalized in ('DOMINGO_MANHA', 'CULTO_DA_MANHA', 'CULTODAMANHA', 'MANHA') then
    return 'DOMINGO_MANHA';
  end if;

  if normalized in ('DOMINGO_NOITE', 'CULTO_DA_NOITE', 'CULTODANOITE', 'NOITE') then
    return 'DOMINGO_NOITE';
  end if;

  return null;
end;
$$;

create or replace function public.can_manage_escala_domingo(target_congregation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_congregation is not null
    and public.is_congregation_active(target_congregation)
    and (
      public.is_admin_master()
      or public.has_role(array['SUPER_ADMIN'])
      or (
        public.has_role(array['PASTOR', 'SECRETARIA', 'LIDER_DEPTO'])
        and target_congregation = public.get_my_congregation_id()
      )
    );
$$;

create or replace function public.can_assign_escala_domingo_usuario(
  target_user_id uuid,
  target_congregation uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_perfis up
    where up.user_id = target_user_id
      and up.active is true
      and (
        up.role in ('ADMIN_MASTER', 'SUPER_ADMIN')
        or (
          up.congregation_id = target_congregation
          and up.role in (
            'PASTOR',
            'SECRETARIA',
            'NOVOS_CONVERTIDOS',
            'LIDER_DEPTO',
            'VOLUNTARIO',
            'CADASTRADOR'
          )
        )
      )
  );
$$;

create or replace function public.sync_escala_domingo_usuario_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scale_congregation uuid;
begin
  select ed.congregation_id
    into scale_congregation
  from public.escalas_domingo ed
  where ed.id = new.escala_id;

  if scale_congregation is null then
    raise exception 'Escala nao encontrada.';
  end if;

  if not public.can_assign_escala_domingo_usuario(new.usuario_id, scale_congregation) then
    raise exception 'O usuario precisa estar cadastrado e ativo no CCM para entrar na escala.';
  end if;

  new.congregation_id := scale_congregation;
  new.status_presenca := coalesce(new.status_presenca, 'pendente');

  if new.status_presenca = 'pendente' then
    new.respondido_em := null;
  elsif new.respondido_em is null then
    new.respondido_em := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_touch_escalas_domingo on public.escalas_domingo;
create trigger trg_touch_escalas_domingo
before update on public.escalas_domingo
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_escalas_domingo_usuarios on public.escalas_domingo_usuarios;
create trigger trg_touch_escalas_domingo_usuarios
before update on public.escalas_domingo_usuarios
for each row execute function public.touch_updated_at();

drop trigger if exists trg_sync_escalas_domingo_usuarios on public.escalas_domingo_usuarios;
create trigger trg_sync_escalas_domingo_usuarios
before insert or update on public.escalas_domingo_usuarios
for each row execute function public.sync_escala_domingo_usuario_context();

drop policy if exists "escalas_domingo_read" on public.escalas_domingo;
drop policy if exists "escalas_domingo_manage" on public.escalas_domingo;

create policy "escalas_domingo_read" on public.escalas_domingo
  for select
  using (
    public.can_manage_escala_domingo(congregation_id)
    or exists (
      select 1
      from public.escalas_domingo_usuarios edu
      where edu.escala_id = id
        and edu.usuario_id = auth.uid()
    )
  );

create policy "escalas_domingo_manage" on public.escalas_domingo
  for all
  using (public.can_manage_escala_domingo(congregation_id))
  with check (public.can_manage_escala_domingo(congregation_id));

drop policy if exists "escalas_domingo_usuarios_read" on public.escalas_domingo_usuarios;
drop policy if exists "escalas_domingo_usuarios_manage" on public.escalas_domingo_usuarios;

create policy "escalas_domingo_usuarios_read" on public.escalas_domingo_usuarios
  for select
  using (
    public.can_manage_escala_domingo(congregation_id)
    or usuario_id = auth.uid()
  );

create policy "escalas_domingo_usuarios_manage" on public.escalas_domingo_usuarios
  for all
  using (public.can_manage_escala_domingo(congregation_id))
  with check (public.can_manage_escala_domingo(congregation_id));

create or replace function public.create_sunday_service_scale(
  service_name text,
  service_date date,
  service_time time,
  assigned_user_ids uuid[]
)
returns table (
  scale_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  normalized_culto text := public.normalize_escala_domingo_culto(service_name);
  deduped_user_ids uuid[];
  invalid_user_count integer := 0;
  created_scale_id uuid;
begin
  effective_congregation := public.get_my_congregation_id();

  if not public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'PASTOR', 'SECRETARIA', 'LIDER_DEPTO']) then
    raise exception 'not allowed';
  end if;

  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  if normalized_culto is null then
    raise exception 'Culto invalido.';
  end if;

  if service_date is null then
    raise exception 'Data invalida.';
  end if;

  if extract(dow from service_date) <> 0 then
    raise exception 'A escala deve ser criada para domingo.';
  end if;

  if service_time is null then
    raise exception 'Horario invalido.';
  end if;

  select coalesce(array_agg(distinct user_id), '{}'::uuid[])
    into deduped_user_ids
  from unnest(coalesce(assigned_user_ids, '{}'::uuid[])) as user_id
  where user_id is not null;

  if coalesce(array_length(deduped_user_ids, 1), 0) = 0 then
    raise exception 'Selecione ao menos um usuario.';
  end if;

  select count(*)
    into invalid_user_count
  from unnest(deduped_user_ids) as user_id
  where not public.can_assign_escala_domingo_usuario(user_id, effective_congregation);

  if invalid_user_count > 0 then
    raise exception 'A lista possui usuarios fora da base permitida do CCM.';
  end if;

  insert into public.escalas_domingo (
    congregation_id,
    culto,
    data,
    horario,
    criado_por
  )
  values (
    effective_congregation,
    normalized_culto,
    service_date,
    service_time,
    auth.uid()
  )
  returning id into created_scale_id;

  insert into public.escalas_domingo_usuarios (
    escala_id,
    usuario_id,
    congregation_id,
    status_presenca
  )
  select
    created_scale_id,
    user_id,
    effective_congregation,
    'pendente'
  from unnest(deduped_user_ids) as user_id;

  return query select created_scale_id;
end;
$$;

create or replace function public.respond_sunday_service_scale(
  assignment_id uuid,
  next_status text
)
returns table (
  escala_usuario_id uuid,
  escala_id uuid,
  status_presenca text,
  respondido_em timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
  target_assignment public.escalas_domingo_usuarios%rowtype;
begin
  normalized_status := lower(btrim(coalesce(next_status, '')));

  if normalized_status in ('nao poderei ir', 'nao_poderei_ir', 'nao podera ir', 'nao_podera_ir', 'ausente') then
    normalized_status := 'nao_podera_ir';
  end if;

  if normalized_status not in ('pendente', 'confirmado', 'nao_podera_ir') then
    raise exception 'Status invalido.';
  end if;

  select *
    into target_assignment
  from public.escalas_domingo_usuarios edu
  where edu.id = assignment_id;

  if not found then
    raise exception 'Escala nao encontrada.';
  end if;

  if target_assignment.usuario_id <> auth.uid() then
    raise exception 'not allowed';
  end if;

  if target_assignment.congregation_id is null or not public.is_congregation_active(target_assignment.congregation_id) then
    raise exception 'congregation inactive';
  end if;

  return query
  update public.escalas_domingo_usuarios
  set status_presenca = normalized_status,
      respondido_em = case when normalized_status = 'pendente' then null else now() end
  where id = assignment_id
  returning
    public.escalas_domingo_usuarios.id as escala_usuario_id,
    public.escalas_domingo_usuarios.escala_id,
    public.escalas_domingo_usuarios.status_presenca,
    public.escalas_domingo_usuarios.respondido_em;
end;
$$;

grant execute on function public.normalize_escala_domingo_culto(text) to authenticated;
grant execute on function public.can_manage_escala_domingo(uuid) to authenticated;
grant execute on function public.can_assign_escala_domingo_usuario(uuid, uuid) to authenticated;
grant execute on function public.create_sunday_service_scale(text, date, time, uuid[]) to authenticated;
grant execute on function public.respond_sunday_service_scale(uuid, text) to authenticated;

grant select, insert, update, delete on table public.escalas_domingo to authenticated;
grant select, insert, update, delete on table public.escalas_domingo_usuarios to authenticated;
