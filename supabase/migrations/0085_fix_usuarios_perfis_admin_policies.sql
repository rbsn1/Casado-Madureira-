-- Adiciona policies de escrita para admins em usuarios_perfis.
--
-- A tabela tinha RLS habilitado mas apenas uma policy de SELECT (users_read_own_roles).
-- Sem policies de INSERT/UPDATE/DELETE, o PostgREST bloqueava qualquer escrita
-- mesmo via service role client, causando "permission denied for table usuarios_perfis"
-- no painel de admin ao criar usuários ou atribuir roles.

-- Admins podem ler todos os perfis (além da policy users_read_own_roles já existente)
create policy "admin_read_all_roles"
  on public.usuarios_perfis
  for select
  to authenticated
  using (public.is_admin_master());

-- Admins podem inserir novos perfis
create policy "admin_insert_roles"
  on public.usuarios_perfis
  for insert
  to authenticated
  with check (public.is_admin_master());

-- Admins podem atualizar perfis existentes
create policy "admin_update_roles"
  on public.usuarios_perfis
  for update
  to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

-- Admins podem deletar perfis
create policy "admin_delete_roles"
  on public.usuarios_perfis
  for delete
  to authenticated
  using (public.is_admin_master());
