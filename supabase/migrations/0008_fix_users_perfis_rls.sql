-- Evita recursão de RLS ao consultar usuarios_perfis via has_role
drop policy if exists "admin_manage_roles" on public.usuarios_perfis;
drop policy if exists "users_read_own_roles" on public.usuarios_perfis;

create policy "users_read_own_roles" on public.usuarios_perfis
  for select
  using (auth.uid() = user_id);
