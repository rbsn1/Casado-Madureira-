-- Novo perfil de Discipulado: ADMIN_DISCIPULADO.
-- Objetivo: separar administração do módulo das funções operacionais do DISCIPULADOR.

alter table public.usuarios_perfis
  drop constraint if exists usuarios_perfis_role_check;

alter table public.usuarios_perfis
  add constraint usuarios_perfis_role_check
  check (
    role in (
      'ADMIN_MASTER',
      'SUPER_ADMIN',
      'PASTOR',
      'SECRETARIA',
      'NOVOS_CONVERTIDOS',
      'LIDER_DEPTO',
      'VOLUNTARIO',
      'CADASTRADOR',
      'ADMIN_DISCIPULADO',
      'DISCIPULADOR',
      'SM_DISCIPULADO',
      'SECRETARIA_DISCIPULADO'
    )
  );

create or replace function public.enforce_discipleship_role_isolation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.active, true) is true then
    if new.role in ('ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO') then
      if exists (
        select 1
        from public.usuarios_perfis up
        where up.user_id = new.user_id
          and up.active is true
          and up.role <> new.role
      ) then
        raise exception 'Usuário com perfil de discipulado não pode possuir outros papéis ativos.';
      end if;
    else
      if exists (
        select 1
        from public.usuarios_perfis up
        where up.user_id = new.user_id
          and up.active is true
          and up.role in ('ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
          and up.role <> new.role
      ) then
        raise exception 'Usuário com perfil de discipulado ativo não pode receber papéis do CCM/admin.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Higieniza legado para manter apenas um papel de discipulado ativo por usuário.
with discipulado_users as (
  select distinct up.user_id
  from public.usuarios_perfis up
  where up.active is true
    and up.role in ('ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
)
update public.usuarios_perfis up
set active = false
from discipulado_users du
where up.user_id = du.user_id
  and up.active is true
  and up.role not in ('ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO');

with ranked_discipulado_roles as (
  select
    up.ctid,
    row_number() over (
      partition by up.user_id
      order by
        case
          when up.role = 'ADMIN_DISCIPULADO' then 0
          when up.role = 'DISCIPULADOR' then 1
          when up.role = 'SM_DISCIPULADO' then 2
          else 3
        end,
        up.created_at asc
    ) as rn
  from public.usuarios_perfis up
  where up.active is true
    and up.role in ('ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
)
update public.usuarios_perfis up
set active = false
from ranked_discipulado_roles r
where up.ctid = r.ctid
  and r.rn > 1;

update public.profiles p
set role = 'user'
where p.role is distinct from 'user'
  and exists (
    select 1
    from public.usuarios_perfis up
    where up.user_id = p.id
      and up.active is true
      and up.role in ('ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
  );

create or replace function public.is_discipulado_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']);
$$;

grant execute on function public.is_discipulado_user() to authenticated;
