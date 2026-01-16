-- Atualiza políticas RLS conforme matriz de roles

-- pessoas
drop policy if exists "anon_create_pessoas" on public.pessoas;
drop policy if exists "team_manage_pessoas" on public.pessoas;
drop policy if exists "pessoas_read" on public.pessoas;
drop policy if exists "pessoas_manage" on public.pessoas;

create policy "pessoas_read" on public.pessoas
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO','VOLUNTARIO']));

create policy "pessoas_manage" on public.pessoas
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

create policy "anon_create_pessoas" on public.pessoas
  for insert
  with check (auth.role() = 'anon');

-- integracao_novos_convertidos
drop policy if exists "anon_create_fila" on public.integracao_novos_convertidos;
drop policy if exists "team_manage_integracao" on public.integracao_novos_convertidos;
drop policy if exists "integracao_read" on public.integracao_novos_convertidos;
drop policy if exists "integracao_manage" on public.integracao_novos_convertidos;

create policy "integracao_read" on public.integracao_novos_convertidos
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']));

create policy "integracao_manage" on public.integracao_novos_convertidos
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']));

create policy "anon_create_fila" on public.integracao_novos_convertidos
  for insert
  with check (auth.role() = 'anon');

-- batismos
drop policy if exists "batismos_read" on public.batismos;
drop policy if exists "batismos_manage" on public.batismos;

create policy "batismos_read" on public.batismos
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']));

create policy "batismos_manage" on public.batismos
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

-- departamentos
drop policy if exists "departamentos_read" on public.departamentos;
drop policy if exists "departamentos_manage" on public.departamentos;

create policy "departamentos_read" on public.departamentos
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','VOLUNTARIO']));

create policy "departamentos_manage" on public.departamentos
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']));

-- pessoa_departamento
drop policy if exists "pessoa_departamento_read" on public.pessoa_departamento;
drop policy if exists "pessoa_departamento_manage" on public.pessoa_departamento;

create policy "pessoa_departamento_read" on public.pessoa_departamento
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO','VOLUNTARIO']));

create policy "pessoa_departamento_manage" on public.pessoa_departamento
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','LIDER_DEPTO']));

-- eventos_timeline
drop policy if exists "timeline_read" on public.eventos_timeline;
drop policy if exists "timeline_insert" on public.eventos_timeline;

create policy "timeline_read" on public.eventos_timeline
  for select
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']));

create policy "timeline_insert" on public.eventos_timeline
  for insert
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']));
