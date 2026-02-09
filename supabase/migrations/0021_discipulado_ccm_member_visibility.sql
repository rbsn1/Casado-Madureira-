-- Garante visibilidade dos membros do CCM no fluxo de Discipulado
-- Mudança aditiva e segura.

-- 1) Policy complementar para leitura de membros por perfis do discipulado
drop policy if exists "pessoas_read_discipulado_bridge" on public.pessoas;
create policy "pessoas_read_discipulado_bridge" on public.pessoas
  for select
  using (
    public.has_role(array['CADASTRADOR', 'DISCIPULADOR', 'SM_DISCIPULADO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 2) RPC segura para buscar membros do CCM no cadastro de novo convertido
create or replace function public.search_ccm_members_for_discipleship(
  search_text text default '',
  rows_limit int default 8,
  target_congregation_id uuid default null
)
returns table (
  id uuid,
  nome_completo text,
  telefone_whatsapp text,
  congregation_id uuid,
  cadastro_completo_status text,
  has_active_case boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  is_global_admin boolean;
  safe_limit int;
  term text;
begin
  if not public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN', 'DISCIPULADOR', 'CADASTRADOR']) then
    raise exception 'not allowed';
  end if;

  is_global_admin := public.is_admin_master() or public.has_role(array['SUPER_ADMIN']);
  if is_global_admin then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  safe_limit := greatest(1, least(coalesce(rows_limit, 8), 20));
  term := btrim(coalesce(search_text, ''));

  return query
  select
    p.id,
    p.nome_completo,
    p.telefone_whatsapp,
    p.congregation_id,
    p.cadastro_completo_status,
    exists (
      select 1
      from public.discipleship_cases dc
      where dc.member_id = p.id
        and dc.status in ('em_discipulado', 'pausado')
    ) as has_active_case
  from public.pessoas p
  where (effective_congregation is null or p.congregation_id = effective_congregation)
    and (term = '' or p.nome_completo ilike '%' || term || '%')
  order by p.nome_completo
  limit safe_limit;
end;
$$;

grant execute on function public.search_ccm_members_for_discipleship(text, int, uuid) to authenticated;
