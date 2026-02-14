-- Discipulado: permite cadastro de membro no CCM (mesma congregação) via RPC segura.
-- Uso principal: formulário de novo convertido no módulo de Discipulado.

create or replace function public.create_ccm_member_from_discipleship(
  full_name text,
  phone_whatsapp text,
  origin text default null,
  origin_church text default null,
  neighborhood text default null,
  notes text default null
)
returns table (
  member_id uuid,
  nome_completo text,
  telefone_whatsapp text,
  congregation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_congregation uuid;
  normalized_name text := btrim(coalesce(full_name, ''));
  raw_digits text := regexp_replace(coalesce(phone_whatsapp, ''), '\D', '', 'g');
  normalized_phone text;
  normalized_origin text := nullif(btrim(coalesce(origin, '')), '');
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes, '')), '');
begin
  if not public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  if normalized_name = '' or char_length(normalized_name) < 3 then
    raise exception 'Nome completo inválido.';
  end if;

  if raw_digits like '55%' and char_length(raw_digits) in (12, 13) then
    raw_digits := substr(raw_digits, 3);
  end if;

  if char_length(raw_digits) not in (10, 11) then
    raise exception 'Telefone inválido. Informe DDD + número.';
  end if;

  if char_length(raw_digits) = 11 then
    normalized_phone := '(' || substr(raw_digits, 1, 2) || ') ' || substr(raw_digits, 3, 5) || '-' || substr(raw_digits, 8, 4);
  else
    normalized_phone := '(' || substr(raw_digits, 1, 2) || ') ' || substr(raw_digits, 3, 4) || '-' || substr(raw_digits, 7, 4);
  end if;

  if normalized_neighborhood is not null and char_length(normalized_neighborhood) < 2 then
    raise exception 'Bairro precisa ter ao menos 2 caracteres.';
  end if;

  return query
  insert into public.pessoas (
    nome_completo,
    telefone_whatsapp,
    origem,
    igreja_origem,
    bairro,
    observacoes,
    congregation_id,
    request_id
  )
  values (
    normalized_name,
    normalized_phone,
    normalized_origin,
    normalized_origin_church,
    normalized_neighborhood,
    normalized_notes,
    effective_congregation,
    gen_random_uuid()
  )
  returning
    id as member_id,
    public.pessoas.nome_completo,
    public.pessoas.telefone_whatsapp,
    public.pessoas.congregation_id;
end;
$$;

grant execute on function public.create_ccm_member_from_discipleship(text, text, text, text, text, text) to authenticated;
