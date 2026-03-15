-- CCM: RPC segura para cadastro completo interno.

create or replace function public.create_full_ccm_registration(
  full_name text,
  phone_whatsapp text,
  registered_on date default null,
  service_origin text default null,
  cpf_text text default null,
  rg_text text default null,
  origin_church text default null,
  neighborhood_text text default null,
  photo_url_text text default null,
  birth_date date default null,
  email_text text default null,
  address_text text default null,
  notes_text text default null,
  request_id uuid default null
)
returns table (
  member_id uuid,
  nome_completo text,
  telefone_whatsapp text,
  congregation_id uuid,
  cadastro_completo_status text
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
  normalized_registered_on date := coalesce(registered_on, current_date);
  normalized_culto_origem text := public.normalize_pessoa_culto_origem(service_origin);
  normalized_origem text;
  normalized_cpf text := public.normalize_cpf(cpf_text);
  normalized_rg text := nullif(btrim(coalesce(rg_text, '')), '');
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood_text, '')), '');
  normalized_photo_url text := nullif(btrim(coalesce(photo_url_text, '')), '');
  normalized_email text := nullif(lower(btrim(coalesce(email_text, ''))), '');
  normalized_address text := nullif(btrim(coalesce(address_text, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes_text, '')), '');
begin
  if not public.has_role(array['ADMIN_MASTER', 'PASTOR', 'SECRETARIA', 'NOVOS_CONVERTIDOS']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  if normalized_name = '' or char_length(normalized_name) < 3 then
    raise exception 'Nome completo invalido.';
  end if;

  if raw_digits like '55%' and char_length(raw_digits) in (12, 13) then
    raw_digits := substr(raw_digits, 3);
  end if;

  if char_length(raw_digits) not in (10, 11) then
    raise exception 'Telefone invalido. Informe DDD + numero.';
  end if;

  if char_length(raw_digits) = 11 then
    normalized_phone := '(' || substr(raw_digits, 1, 2) || ') ' || substr(raw_digits, 3, 5) || '-' || substr(raw_digits, 8, 4);
  else
    normalized_phone := '(' || substr(raw_digits, 1, 2) || ') ' || substr(raw_digits, 3, 4) || '-' || substr(raw_digits, 7, 4);
  end if;

  if normalized_culto_origem is null then
    raise exception 'Culto de origem invalido.';
  end if;

  if normalized_cpf is null or not public.is_valid_cpf(normalized_cpf) then
    raise exception 'CPF inválido.';
  end if;

  if normalized_rg is null then
    raise exception 'RG é obrigatório.';
  end if;

  normalized_origem := public.culto_origem_to_legacy_label(normalized_culto_origem);

  if request_id is not null then
    return query
    select
      p.id as member_id,
      p.nome_completo,
      p.telefone_whatsapp,
      p.congregation_id,
      p.cadastro_completo_status
    from public.pessoas p
    where p.request_id = request_id
      and p.congregation_id = effective_congregation
    limit 1;

    if found then
      return;
    end if;
  end if;

  if exists (
    select 1
    from public.pessoas p
    where p.congregation_id = effective_congregation
      and p.cpf = normalized_cpf
  ) then
    raise exception 'Já existe membro com este CPF nesta congregação.';
  end if;

  return query
  insert into public.pessoas (
    nome_completo,
    telefone_whatsapp,
    origem,
    culto_origem,
    data,
    igreja_origem,
    bairro,
    observacoes,
    cpf,
    rg,
    foto_url,
    data_nascimento,
    email,
    endereco,
    congregation_id,
    cadastro_origem,
    cadastro_completo_status,
    cadastro_completo_at,
    created_by,
    request_id
  )
  values (
    normalized_name,
    normalized_phone,
    normalized_origem,
    normalized_culto_origem,
    normalized_registered_on,
    normalized_origin_church,
    normalized_neighborhood,
    normalized_notes,
    normalized_cpf,
    normalized_rg,
    normalized_photo_url,
    birth_date,
    normalized_email,
    normalized_address,
    effective_congregation,
    'ccm',
    'concluido',
    now(),
    auth.uid(),
    coalesce(request_id, gen_random_uuid())
  )
  returning
    id as member_id,
    public.pessoas.nome_completo,
    public.pessoas.telefone_whatsapp,
    public.pessoas.congregation_id,
    public.pessoas.cadastro_completo_status;
end;
$$;

grant execute on function public.create_full_ccm_registration(text, text, date, text, text, text, text, text, text, date, text, text, text, uuid) to authenticated;
