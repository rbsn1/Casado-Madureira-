-- Isolamento de ambientes:
-- Se o usuário possui perfil ativo de discipulado, remove papéis ativos do CCM/admin.
-- Mudança aditiva e segura (sem drop de tabela/coluna/dados).

with discipulado_users as (
  select distinct up.user_id
  from public.usuarios_perfis up
  where up.active is true
    and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO')
)
update public.usuarios_perfis up
set active = false
from discipulado_users du
where up.user_id = du.user_id
  and up.active is true
  and up.role not in ('DISCIPULADOR', 'SM_DISCIPULADO');

-- Higieniza legado: caso exista mais de um papel de discipulado ativo para o mesmo usuário,
-- mantém apenas o mais prioritário (DISCIPULADOR) e desativa os demais.
with ranked_discipulado_roles as (
  select
    up.ctid,
    row_number() over (
      partition by up.user_id
      order by
        case when up.role = 'DISCIPULADOR' then 0 else 1 end,
        up.created_at asc
    ) as rn
  from public.usuarios_perfis up
  where up.active is true
    and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO')
)
update public.usuarios_perfis up
set active = false
from ranked_discipulado_roles r
where up.ctid = r.ctid
  and r.rn > 1;

-- Mantém compatibilidade com o perfil legado em public.profiles.
update public.profiles p
set role = 'user'
where p.role is distinct from 'user'
  and exists (
    select 1
    from public.usuarios_perfis up
    where up.user_id = p.id
      and up.active is true
      and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO')
  );
