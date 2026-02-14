-- Discipulado: lista completa de cadastros do CCM na mesma congregação.
-- Retorna membros com indicação se já possuem case ativo.

create or replace function public.list_ccm_members_for_discipleship(
  search_text text default null,
  rows_limit int default 500,
  rows_offset int default 0
)
returns table (
  member_id uuid,
  member_name text,
  member_phone text,
  created_at timestamptz,
  has_active_case boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  safe_limit int := greatest(1, least(coalesce(rows_limit, 500), 1000));
  safe_offset int := greatest(0, coalesce(rows_offset, 0));
  term text := nullif(btrim(coalesce(search_text, '')), '');
begin
  if not public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  return query
  select
    p.id as member_id,
    p.nome_completo as member_name,
    p.telefone_whatsapp as member_phone,
    p.created_at,
    exists (
      select 1
      from public.discipleship_cases dc
      where dc.member_id = p.id
        and dc.status in ('em_discipulado', 'pausado')
    ) as has_active_case
  from public.pessoas p
  where p.congregation_id = effective_congregation
    and (
      term is null
      or p.nome_completo ilike '%' || term || '%'
      or coalesce(p.telefone_whatsapp, '') ilike '%' || term || '%'
    )
  order by p.created_at desc nulls last, p.nome_completo
  offset safe_offset
  limit safe_limit;
end;
$$;

grant execute on function public.list_ccm_members_for_discipleship(text, int, int) to authenticated;
