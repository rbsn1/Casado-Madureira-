-- Restringe cadastro de novo convertido no discipulado ao perfil CADASTRADOR
-- Mudança aditiva e segura: não remove tabelas/colunas/dados.

-- 1) CADASTRADOR pode buscar membros (fonte CCM) apenas na própria congregação ativa.
drop policy if exists "pessoas_read_cadastrador_discipulado" on public.pessoas;
create policy "pessoas_read_cadastrador_discipulado" on public.pessoas
  for select
  using (
    public.has_role(array['CADASTRADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

-- 2) Desativa inserção do perfil legado SM_DISCIPULADO no case do discipulado.
drop policy if exists "discipleship_cases_insert_sm_discipulado" on public.discipleship_cases;

-- 3) Separa gerenciamento de cases para impedir INSERT por ADMIN/DISCIPULADOR.
drop policy if exists "discipleship_cases_manage" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage_update" on public.discipleship_cases;
drop policy if exists "discipleship_cases_manage_delete" on public.discipleship_cases;

create policy "discipleship_cases_manage_update" on public.discipleship_cases
  for update
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  )
  with check (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

create policy "discipleship_cases_manage_delete" on public.discipleship_cases
  for delete
  using (
    public.is_admin_master()
    or (
      public.has_role(array['DISCIPULADOR'])
      and congregation_id = public.get_my_congregation_id()
      and public.is_congregation_active(congregation_id)
    )
  );

-- 4) INSERT exclusivo para perfil CADASTRADOR (por congregação ativa).
drop policy if exists "discipleship_cases_insert_cadastrador" on public.discipleship_cases;
create policy "discipleship_cases_insert_cadastrador" on public.discipleship_cases
  for insert
  with check (
    public.has_role(array['CADASTRADOR'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );
