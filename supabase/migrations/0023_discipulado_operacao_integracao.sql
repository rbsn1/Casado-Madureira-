-- Fluxo: operações de integração passam para o módulo Discipulado.
-- Mudança aditiva: atualiza policies para permitir operação por DISCIPULADOR.

-- integracao_novos_convertidos
drop policy if exists "integracao_read" on public.integracao_novos_convertidos;
drop policy if exists "integracao_manage" on public.integracao_novos_convertidos;

create policy "integracao_read" on public.integracao_novos_convertidos
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "integracao_manage" on public.integracao_novos_convertidos
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- batismos
drop policy if exists "batismos_read" on public.batismos;
drop policy if exists "batismos_manage" on public.batismos;

create policy "batismos_read" on public.batismos
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "batismos_manage" on public.batismos
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- departamentos (leitura para vínculo)
drop policy if exists "departamentos_read" on public.departamentos;

create policy "departamentos_read" on public.departamentos
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','VOLUNTARIO','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- pessoa_departamento (vínculo feito no discipulado)
drop policy if exists "pessoa_departamento_read" on public.pessoa_departamento;
drop policy if exists "pessoa_departamento_manage" on public.pessoa_departamento;

create policy "pessoa_departamento_read" on public.pessoa_departamento
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','VOLUNTARIO','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

create policy "pessoa_departamento_manage" on public.pessoa_departamento
  for all
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  )
  with check (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','DISCIPULADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );
