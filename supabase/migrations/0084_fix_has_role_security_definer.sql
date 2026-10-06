-- Corrige has_role para SECURITY DEFINER.
--
-- A função has_role lia usuarios_perfis como SECURITY INVOKER (permissões do
-- usuário autenticado). Com RLS ativo na tabela e a policy users_read_own_roles
-- permitindo apenas leitura da própria linha, qualquer contexto que invoca
-- has_role em nome de outro usuário recebia "permission denied".
--
-- Tornando-a SECURITY DEFINER ela passa a executar como postgres, consistente
-- com get_my_context, is_admin_master e get_my_congregation_id.

create or replace function public.has_role(target_roles text[])
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_perfis up
    where up.user_id = auth.uid()
      and up.active
      and up.role = any(target_roles)
  );
$$;
