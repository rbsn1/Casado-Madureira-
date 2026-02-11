-- Departamentos sob gestão do Discipulado
-- Mudança aditiva: atualiza somente policies (sem apagar tabelas/colunas/dados).

-- 1) Criação/edição/exclusão de departamentos passa para DISCIPULADOR (ou admin global).
drop policy if exists "departamentos_manage" on public.departamentos;
create policy "departamentos_manage" on public.departamentos
  for all
  using (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 2) Vínculo de membros aos departamentos passa para DISCIPULADOR (ou admin global).
drop policy if exists "pessoa_departamento_manage" on public.pessoa_departamento;
create policy "pessoa_departamento_manage" on public.pessoa_departamento
  for all
  using (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 3) Contatos públicos dos departamentos também ficam sob gestão do Discipulado.
drop policy if exists "departamentos_publicos_manage" on public.departamentos_publicos;
create policy "departamentos_publicos_manage" on public.departamentos_publicos
  for all
  using (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 4) Novo modelo departments/* também fica sob gestão do Discipulado.
drop policy if exists "departments_manage_admin" on public.departments;
create policy "departments_manage_admin" on public.departments
  for all
  using (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

drop policy if exists "department_roles_manage_admin" on public.department_roles;
create policy "department_roles_manage_admin" on public.department_roles
  for all
  using (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

drop policy if exists "department_contacts_manage_admin" on public.department_contacts;
create policy "department_contacts_manage_admin" on public.department_contacts
  for all
  using (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

drop policy if exists "department_faq_manage_admin" on public.department_faq;
create policy "department_faq_manage_admin" on public.department_faq
  for all
  using (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    (public.is_admin_master() or public.has_role(array['SUPER_ADMIN','DISCIPULADOR']))
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );
