-- Perfil SM_DISCIPULADO: acesso restrito ao cadastro de novo convertido

alter table public.usuarios_perfis
  drop constraint if exists usuarios_perfis_role_check;

alter table public.usuarios_perfis
  add constraint usuarios_perfis_role_check
  check (
    role in (
      'ADMIN_MASTER',
      'SUPER_ADMIN',
      'PASTOR',
      'SECRETARIA',
      'NOVOS_CONVERTIDOS',
      'LIDER_DEPTO',
      'VOLUNTARIO',
      'CADASTRADOR',
      'DISCIPULADOR',
      'SM_DISCIPULADO'
    )
  );

create or replace function public.enforce_discipleship_role_isolation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.active, true) is true then
    if new.role in ('DISCIPULADOR', 'SM_DISCIPULADO') then
      if exists (
        select 1
        from public.usuarios_perfis up
        where up.user_id = new.user_id
          and up.active is true
          and up.role <> new.role
      ) then
        raise exception 'Usuário com perfil de discipulado não pode possuir outros papéis ativos.';
      end if;
    else
      if exists (
        select 1
        from public.usuarios_perfis up
        where up.user_id = new.user_id
          and up.active is true
          and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO')
          and up.role <> new.role
      ) then
        raise exception 'Usuário com perfil de discipulado ativo não pode receber papéis do CCM/admin.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_discipleship_role_isolation on public.usuarios_perfis;
create trigger trg_enforce_discipleship_role_isolation
before insert or update on public.usuarios_perfis
for each row execute function public.enforce_discipleship_role_isolation();

drop policy if exists "pessoas_read_sm_discipulado" on public.pessoas;
create policy "pessoas_read_sm_discipulado" on public.pessoas
  for select
  using (
    public.has_role(array['SM_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

drop policy if exists "discipleship_cases_insert_sm_discipulado" on public.discipleship_cases;
create policy "discipleship_cases_insert_sm_discipulado" on public.discipleship_cases
  for insert
  with check (
    public.has_role(array['SM_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );
