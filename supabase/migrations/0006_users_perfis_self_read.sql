-- Permitir que o próprio usuário leia seus roles ativos
drop policy if exists "users_read_own_roles" on public.usuarios_perfis;

create policy "users_read_own_roles" on public.usuarios_perfis
  for select
  using (auth.uid() = user_id);
