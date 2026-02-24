-- Discipulado: corrige correlação entre origem textual e culto canônico.
-- Objetivo: manter compatibilidade com "origem" e padronizar analytics via "culto_origem".

alter table public.pessoas
  add column if not exists culto_origem text;

alter table public.pessoas
  drop constraint if exists pessoas_culto_origem_check;

alter table public.pessoas
  add constraint pessoas_culto_origem_check
  check (culto_origem in ('MANHA', 'NOITE', 'MJ', 'QUARTA', 'OUTROS') or culto_origem is null);

create or replace function public.normalize_pessoa_culto_origem(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := upper(
    translate(
      coalesce(btrim(raw_value), ''),
      'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )
  );

  if normalized = '' then
    return null;
  end if;

  if normalized = 'MANHA' or normalized like '%MANHA%' then
    return 'MANHA';
  end if;

  if normalized = 'NOITE' or normalized like '%NOITE%' then
    return 'NOITE';
  end if;

  if normalized = 'QUARTA' or normalized like '%QUARTA%' then
    return 'QUARTA';
  end if;

  if normalized = 'MJ' or normalized like '%CULTODOMJ%' or normalized like '%MJ%' then
    return 'MJ';
  end if;

  if normalized = 'OUTROS' or normalized like '%OUTRO%' or normalized like '%EVENT%' or normalized like '%TARDE%' then
    return 'OUTROS';
  end if;

  return null;
end;
$$;

create or replace function public.culto_origem_to_legacy_label(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text := public.normalize_pessoa_culto_origem(raw_value);
begin
  if normalized = 'MANHA' then
    return 'Culto da Manhã';
  end if;
  if normalized = 'NOITE' then
    return 'Culto da Noite';
  end if;
  if normalized = 'QUARTA' then
    return 'Culto de Quarta';
  end if;
  if normalized = 'MJ' then
    return 'Culto do MJ';
  end if;
  if normalized = 'OUTROS' then
    return 'Outros eventos';
  end if;
  return null;
end;
$$;

create or replace function public.sync_pessoa_culto_origem()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.culto_origem := public.normalize_pessoa_culto_origem(coalesce(new.culto_origem, new.origem));

  if (new.origem is null or btrim(new.origem) = '') and new.culto_origem is not null then
    new.origem := public.culto_origem_to_legacy_label(new.culto_origem);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_pessoa_culto_origem on public.pessoas;
create trigger trg_sync_pessoa_culto_origem
before insert or update of origem, culto_origem on public.pessoas
for each row execute function public.sync_pessoa_culto_origem();

update public.pessoas p
set culto_origem = public.normalize_pessoa_culto_origem(coalesce(p.culto_origem, p.origem))
where p.culto_origem is distinct from public.normalize_pessoa_culto_origem(coalesce(p.culto_origem, p.origem));

update public.pessoas p
set origem = public.culto_origem_to_legacy_label(p.culto_origem)
where (p.origem is null or btrim(p.origem) = '')
  and p.culto_origem is not null;

create index if not exists pessoas_congregation_culto_origem_created_at_idx
  on public.pessoas (congregation_id, culto_origem, created_at desc);

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
  normalized_culto_origem text := public.normalize_pessoa_culto_origem(normalized_origin);
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes, '')), '');
begin
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
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
    culto_origem,
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
    normalized_culto_origem,
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
  normalized_culto_origem text := public.normalize_pessoa_culto_origem(normalized_origin);
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
      culto_origem = normalized_culto_origem,
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
