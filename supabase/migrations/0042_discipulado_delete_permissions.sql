-- Discipulado: perfis de cadastro podem excluir cadastros e cases no escopo da congregação.
-- Perfis: ADMIN_DISCIPULADO, DISCIPULADOR, SM_DISCIPULADO, SECRETARIA_DISCIPULADO.

-- 1) DELETE em cases para perfis de cadastro do discipulado.
drop policy if exists "discipleship_cases_manage_delete" on public.discipleship_cases;
create policy "discipleship_cases_manage_delete" on public.discipleship_cases
  for delete
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 2) DELETE em cadastros (pessoas) para perfis de cadastro do discipulado.
-- A integridade com case ativo continua protegida pelo FK (member_id -> pessoas.id).
drop policy if exists "pessoas_delete_discipulado_bridge" on public.pessoas;
create policy "pessoas_delete_discipulado_bridge" on public.pessoas
  for delete
  using (
    public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );
