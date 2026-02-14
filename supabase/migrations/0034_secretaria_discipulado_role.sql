-- Novo perfil de Discipulado: SECRETARIA_DISCIPULADO.
-- Objetivo: mesmo escopo operacional de cadastro do SM_DISCIPULADO,
-- mantendo isolamento do módulo e limite por congregação.

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
      'SM_DISCIPULADO',
      'SECRETARIA_DISCIPULADO'
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
    if new.role in ('DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO') then
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
          and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
          and up.role <> new.role
      ) then
        raise exception 'Usuário com perfil de discipulado ativo não pode receber papéis do CCM/admin.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Higieniza legado para o novo perfil de discipulado.
with discipulado_users as (
  select distinct up.user_id
  from public.usuarios_perfis up
  where up.active is true
    and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
)
update public.usuarios_perfis up
set active = false
from discipulado_users du
where up.user_id = du.user_id
  and up.active is true
  and up.role not in ('DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO');

with ranked_discipulado_roles as (
  select
    up.ctid,
    row_number() over (
      partition by up.user_id
      order by
        case when up.role = 'DISCIPULADOR' then 0 else 1 end,
        up.created_at asc
    ) as rn
  from public.usuarios_perfis up
  where up.active is true
    and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
)
update public.usuarios_perfis up
set active = false
from ranked_discipulado_roles r
where up.ctid = r.ctid
  and r.rn > 1;

update public.profiles p
set role = 'user'
where p.role is distinct from 'user'
  and exists (
    select 1
    from public.usuarios_perfis up
    where up.user_id = p.id
      and up.active is true
      and up.role in ('DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO')
  );

create or replace function public.is_discipulado_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']);
$$;

grant execute on function public.is_discipulado_user() to authenticated;

drop policy if exists "pessoas_read" on public.pessoas;
create policy "pessoas_read" on public.pessoas
  for select
  using (
    public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO','VOLUNTARIO'])
    and not public.has_role(array['DISCIPULADOR','SM_DISCIPULADO','SECRETARIA_DISCIPULADO'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

drop policy if exists "pessoas_read_discipulado_bridge" on public.pessoas;
create policy "pessoas_read_discipulado_bridge" on public.pessoas
  for select
  using (
    public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

drop policy if exists "discipleship_cases_insert_discipulado" on public.discipleship_cases;
create policy "discipleship_cases_insert_discipulado" on public.discipleship_cases
  for insert
  with check (
    public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO'])
    and congregation_id = public.get_my_congregation_id()
    and public.is_congregation_active(congregation_id)
  );

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
  safe_limit int;
  term text;
begin
  if not public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  safe_limit := greatest(1, least(coalesce(rows_limit, 8), 20));
  term := btrim(coalesce(search_text, ''));

  if char_length(term) < 2 then
    return;
  end if;

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
  where p.congregation_id = effective_congregation
    and p.nome_completo ilike '%' || term || '%'
  order by p.nome_completo
  limit safe_limit;
end;
$$;

grant execute on function public.search_ccm_members_for_discipleship(text, int, uuid) to authenticated;

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
  if not public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
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
  normalized_name text := btrim(coalesce(full_name, ''));
  normalized_phone text := nullif(btrim(coalesce(phone_whatsapp, '')), '');
  normalized_origin text := nullif(btrim(coalesce(origin, '')), '');
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes, '')), '');
  updated_member_id uuid;
begin
  if not public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
    raise exception 'not allowed';
  end if;

  effective_congregation := public.get_my_congregation_id();
  if effective_congregation is null or not public.is_congregation_active(effective_congregation) then
    raise exception 'congregation inactive';
  end if;

  if target_member_id is null then
    raise exception 'Membro inválido.';
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
  raw_digits text := regexp_replace(coalesce(phone_whatsapp, ''), '\\D', '', 'g');
  normalized_phone text;
  normalized_origin text := nullif(btrim(coalesce(origin, '')), '');
  normalized_origin_church text := nullif(btrim(coalesce(origin_church, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(neighborhood, '')), '');
  normalized_notes text := nullif(btrim(coalesce(notes, '')), '');
begin
  if not public.has_role(array['DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
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

create or replace function public.refresh_discipleship_case_criticality(
  target_congregation_id uuid default null,
  target_case_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int := 0;
  my_congregation uuid;
  is_discipulador boolean := false;
  is_cadastro_discipulado boolean := false;
begin
  if auth.uid() is not null then
    is_discipulador := public.has_role(array['DISCIPULADOR']);
    is_cadastro_discipulado := public.has_role(array['SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']);

    if not (is_discipulador or is_cadastro_discipulado) then
      raise exception 'not allowed';
    end if;

    my_congregation := public.get_my_congregation_id();
    if my_congregation is null or not public.is_congregation_active(my_congregation) then
      raise exception 'congregation inactive';
    end if;

    if target_congregation_id is not null and target_congregation_id <> my_congregation then
      raise exception 'not allowed';
    end if;

    if is_cadastro_discipulado and not is_discipulador then
      if target_case_id is null then
        raise exception 'not allowed';
      end if;
    end if;
  else
    my_congregation := target_congregation_id;
  end if;

  with scoped_cases as (
    select dc.id, dc.congregation_id
    from public.discipleship_cases dc
    where (target_congregation_id is null or dc.congregation_id = target_congregation_id)
      and (target_case_id is null or dc.id = target_case_id)
      and (my_congregation is null or dc.congregation_id = my_congregation)
  ),
  negative_stats as (
    select
      ca.case_id,
      count(*) filter (where public.is_negative_contact_outcome(ca.outcome))::int as negative_contact_count,
      max(ca.created_at) filter (where public.is_negative_contact_outcome(ca.outcome)) as last_negative_contact_at
    from public.contact_attempts ca
    join scoped_cases sc on sc.id = ca.case_id
    group by ca.case_id
  ),
  confra as (
    select
      dc.congregation_id,
      greatest(0, ceil(extract(epoch from (dc.confraternization_at - now())) / 86400.0)::int) as days_to_confra
    from public.discipleship_calendar dc
  ),
  computed as (
    select
      sc.id as case_id,
      coalesce(ns.negative_contact_count, 0) as negative_contact_count,
      cf.days_to_confra,
      ns.last_negative_contact_at,
      public.classify_discipleship_criticality(
        cf.days_to_confra,
        coalesce(ns.negative_contact_count, 0)
      ) as criticality
    from scoped_cases sc
    left join negative_stats ns on ns.case_id = sc.id
    left join confra cf on cf.congregation_id = sc.congregation_id
  ),
  updated as (
    update public.discipleship_cases dc
    set
      negative_contact_count = c.negative_contact_count,
      days_to_confra = c.days_to_confra,
      criticality = c.criticality,
      last_negative_contact_at = c.last_negative_contact_at
    from computed c
    where dc.id = c.case_id
    returning 1
  )
  select count(*) into updated_count
  from updated;

  return coalesce(updated_count, 0);
end;
$$;

grant execute on function public.refresh_discipleship_case_criticality(uuid, uuid) to authenticated;
