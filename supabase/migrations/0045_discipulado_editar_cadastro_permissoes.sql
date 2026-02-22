-- Discipulado: amplia permissões da RPC de edição de cadastro do membro.
-- Resolve "not allowed" para perfis do módulo e mantém escopo por congregação.

create or replace function public.update_ccm_member_profile_from_discipleship(
  target_member_id uuid,
  full_name text,
  phone_whatsapp text,
  origin text default null,
  origin_church text default null,
  neighborhood text default null,
  notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  target_member_congregation uuid;
  normalized_name text := btrim(coalesce(full_name, ''));
  normalized_phone text := nullif(btrim(coalesce(phone_whatsapp, '')), '');
  normalized_origin text := nullif(btrim(coalesce(origin, '')), '');
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes, '')), '');
  updated_member_id uuid;
begin
  if not public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ]) then
    raise exception 'not allowed';
  end if;

  if target_member_id is null then
    raise exception 'Membro inválido.';
  end if;

  select p.congregation_id
  into target_member_congregation
  from public.pessoas p
  where p.id = target_member_id;

  if target_member_congregation is null then
    raise exception 'Membro não encontrado para a sua congregação.';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null and (public.is_admin_master() or public.has_role(array['SUPER_ADMIN'])) then
    effective_congregation := target_member_congregation;
  end if;

  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  if normalized_name = '' then
    raise exception 'Nome completo é obrigatório.';
  end if;

  if normalized_phone is null then
    raise exception 'Telefone é obrigatório.';
  end if;

  if normalized_neighborhood is not null and char_length(normalized_neighborhood) < 2 then
    raise exception 'Bairro precisa ter ao menos 2 caracteres.';
  end if;

  update public.pessoas p
  set nome_completo = normalized_name,
      telefone_whatsapp = normalized_phone,
      origem = normalized_origin,
      igreja_origem = normalized_origin_church,
      bairro = normalized_neighborhood,
      observacoes = normalized_notes
  where p.id = target_member_id
    and p.congregation_id = effective_congregation
  returning p.id into updated_member_id;

  if updated_member_id is null then
    raise exception 'Membro não encontrado para a sua congregação.';
  end if;

  perform public.log_timeline(
    updated_member_id,
    'CADASTRO',
    'Cadastro atualizado no módulo de discipulado',
    jsonb_build_object('source', 'discipulado')
  );
end;
$$;

grant execute on function public.update_ccm_member_profile_from_discipleship(uuid, text, text, text, text, text, text) to authenticated;
