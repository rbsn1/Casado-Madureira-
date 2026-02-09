-- Cadastro completo de membros (fluxo pós pré-cadastro)
-- Mudança 100% aditiva: sem remover/renomear objetos existentes.

-- 1) Campos adicionais na base única de membros (pessoas)
alter table public.pessoas
  add column if not exists cpf text,
  add column if not exists rg text,
  add column if not exists foto_url text,
  add column if not exists email text,
  add column if not exists data_nascimento date,
  add column if not exists endereco text,
  add column if not exists cadastro_completo_status text,
  add column if not exists cadastro_completo_token_sent_at timestamptz,
  add column if not exists cadastro_completo_at timestamptz;

update public.pessoas
set cadastro_completo_status = coalesce(cadastro_completo_status, 'pendente')
where cadastro_completo_status is null;

alter table public.pessoas
  alter column cadastro_completo_status set default 'pendente',
  alter column cadastro_completo_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pessoas_cadastro_completo_status_check'
  ) then
    alter table public.pessoas
      add constraint pessoas_cadastro_completo_status_check
      check (cadastro_completo_status in ('pendente', 'link_enviado', 'concluido'));
  end if;
end
$$;

create index if not exists pessoas_cadastro_completo_status_idx
  on public.pessoas (congregation_id, cadastro_completo_status);

create index if not exists pessoas_cadastro_completo_at_idx
  on public.pessoas (congregation_id, cadastro_completo_at desc);

create index if not exists pessoas_congregation_cpf_idx
  on public.pessoas (congregation_id, cpf)
  where cpf is not null and btrim(cpf) <> '';

-- Evita falha de migração caso já exista CPF duplicado.
do $$
begin
  if not exists (
    select 1
    from public.pessoas p
    where p.cpf is not null
      and btrim(p.cpf) <> ''
    group by p.congregation_id, p.cpf
    having count(*) > 1
  ) then
    execute 'create unique index if not exists pessoas_congregation_cpf_uidx on public.pessoas (congregation_id, cpf) where cpf is not null and btrim(cpf) <> ''''';
  else
    raise warning 'Não foi possível aplicar unique(congregation_id, cpf) por dados duplicados existentes.';
  end if;
end
$$;

-- 2) Tabela de links seguros para conclusão cadastral
create table if not exists public.member_profile_completion_links (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  congregation_id uuid not null references public.congregations(id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  revoked_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.member_profile_completion_links enable row level security;

create index if not exists member_profile_completion_links_person_active_idx
  on public.member_profile_completion_links (pessoa_id, created_at desc)
  where used_at is null and revoked_at is null;

create index if not exists member_profile_completion_links_congregation_created_idx
  on public.member_profile_completion_links (congregation_id, created_at desc);

drop policy if exists "member_profile_completion_links_read" on public.member_profile_completion_links;
create policy "member_profile_completion_links_read" on public.member_profile_completion_links
  for select
  using (
    public.has_role(array['ADMIN_MASTER', 'PASTOR', 'SECRETARIA', 'NOVOS_CONVERTIDOS', 'CADASTRADOR'])
    and (
      public.is_admin_master()
      or congregation_id = public.get_my_congregation_id()
    )
  );

-- 3) Helpers de CPF e consistência por congregação
create or replace function public.normalize_cpf(input_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(input_value, ''), '\D', '', 'g'), '');
$$;

create or replace function public.is_valid_cpf(input_value text)
returns boolean
language plpgsql
immutable
as $$
declare
  cpf text := regexp_replace(coalesce(input_value, ''), '\D', '', 'g');
  i int;
  d1 int;
  d2 int;
  sum1 int := 0;
  sum2 int := 0;
begin
  if cpf !~ '^\d{11}$' then
    return false;
  end if;

  if cpf in (
    '00000000000', '11111111111', '22222222222', '33333333333', '44444444444',
    '55555555555', '66666666666', '77777777777', '88888888888', '99999999999'
  ) then
    return false;
  end if;

  for i in 1..9 loop
    sum1 := sum1 + (substr(cpf, i, 1)::int * (11 - i));
  end loop;
  d1 := (sum1 * 10) % 11;
  if d1 = 10 then d1 := 0; end if;

  for i in 1..10 loop
    sum2 := sum2 + (substr(cpf, i, 1)::int * (12 - i));
  end loop;
  d2 := (sum2 * 10) % 11;
  if d2 = 10 then d2 := 0; end if;

  return d1 = substr(cpf, 10, 1)::int
     and d2 = substr(cpf, 11, 1)::int;
end;
$$;

create or replace function public.prevent_duplicate_cpf_per_congregation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.cpf := public.normalize_cpf(new.cpf);

  if new.cpf is null then
    return new;
  end if;

  if not public.is_valid_cpf(new.cpf) then
    raise exception 'CPF inválido.';
  end if;

  if exists (
    select 1
    from public.pessoas p
    where p.congregation_id = new.congregation_id
      and p.cpf = new.cpf
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'Já existe membro com este CPF nesta congregação.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_cpf_per_congregation on public.pessoas;
create trigger trg_prevent_duplicate_cpf_per_congregation
before insert or update of cpf, congregation_id on public.pessoas
for each row execute function public.prevent_duplicate_cpf_per_congregation();

create or replace function public.sync_completion_link_congregation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pessoa_congregation uuid;
begin
  select p.congregation_id into pessoa_congregation
  from public.pessoas p
  where p.id = new.pessoa_id;

  if pessoa_congregation is null then
    raise exception 'Pessoa inválida para gerar link.';
  end if;

  new.congregation_id := pessoa_congregation;
  return new;
end;
$$;

drop trigger if exists trg_sync_completion_link_congregation on public.member_profile_completion_links;
create trigger trg_sync_completion_link_congregation
before insert or update on public.member_profile_completion_links
for each row execute function public.sync_completion_link_congregation();

-- 4) RPC: gerar link de conclusão cadastral para membro pré-cadastrado
create or replace function public.generate_member_completion_token(
  target_member_id uuid,
  ttl_hours int default 72
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  member_congregation uuid;
  member_completion_status text;
  raw_token text;
  token_hash text;
begin
  if not public.has_role(array['ADMIN_MASTER', 'PASTOR', 'SECRETARIA', 'NOVOS_CONVERTIDOS', 'CADASTRADOR']) then
    raise exception 'not allowed';
  end if;

  if target_member_id is null then
    raise exception 'Membro inválido.';
  end if;

  if ttl_hours is null or ttl_hours < 1 or ttl_hours > 720 then
    raise exception 'ttl_hours deve ser entre 1 e 720 horas.';
  end if;

  select p.congregation_id, p.cadastro_completo_status
  into member_congregation, member_completion_status
  from public.pessoas p
  where p.id = target_member_id;

  if member_congregation is null then
    raise exception 'Membro não encontrado.';
  end if;

  if not public.is_admin_master() and member_congregation <> public.get_my_congregation_id() then
    raise exception 'Você só pode gerar links para membros da sua congregação.';
  end if;

  if member_completion_status = 'concluido' then
    raise exception 'Este membro já concluiu o cadastro completo.';
  end if;

  update public.member_profile_completion_links
  set revoked_at = now()
  where pessoa_id = target_member_id
    and used_at is null
    and revoked_at is null
    and expires_at > now();

  raw_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  token_hash := encode(digest(raw_token, 'sha256'), 'hex');

  insert into public.member_profile_completion_links (
    pessoa_id,
    congregation_id,
    token_hash,
    expires_at,
    created_by
  )
  values (
    target_member_id,
    member_congregation,
    token_hash,
    now() + make_interval(hours => ttl_hours),
    auth.uid()
  );

  update public.pessoas
  set cadastro_completo_status = 'link_enviado',
      cadastro_completo_token_sent_at = now()
  where id = target_member_id;

  return raw_token;
end;
$$;

grant execute on function public.generate_member_completion_token(uuid, int) to authenticated;

-- 5) RPC público: validar link e carregar dados mínimos do pré-cadastro
create or replace function public.get_member_completion_payload(token_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_hash text;
  payload jsonb;
begin
  if token_text is null or btrim(token_text) = '' then
    return null;
  end if;

  token_hash := encode(digest(token_text, 'sha256'), 'hex');

  select jsonb_build_object(
    'member_id', p.id,
    'nome_completo', p.nome_completo,
    'telefone_whatsapp', p.telefone_whatsapp,
    'igreja_origem', p.igreja_origem,
    'bairro', p.bairro,
    'cadastro_completo_status', p.cadastro_completo_status,
    'expires_at', l.expires_at
  )
  into payload
  from public.member_profile_completion_links l
  join public.pessoas p on p.id = l.pessoa_id
  where l.token_hash = token_hash
    and l.used_at is null
    and l.revoked_at is null
    and l.expires_at > now()
  order by l.created_at desc
  limit 1;

  return payload;
end;
$$;

grant execute on function public.get_member_completion_payload(text) to anon, authenticated;

-- 6) RPC público: concluir cadastro completo por token
create or replace function public.complete_member_registration_by_token(
  token_text text,
  input_cpf text,
  input_rg text default null,
  input_photo_url text default null,
  input_data_nascimento date default null,
  input_email text default null,
  input_address text default null,
  input_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link_id uuid;
  member_id uuid;
  member_congregation uuid;
  token_hash text;
  normalized_cpf text;
  normalized_rg text;
  normalized_photo_url text;
  normalized_email text;
  normalized_address text;
  normalized_notes text;
begin
  if token_text is null or btrim(token_text) = '' then
    raise exception 'Link inválido.';
  end if;

  token_hash := encode(digest(token_text, 'sha256'), 'hex');

  select l.id, l.pessoa_id, l.congregation_id
  into link_id, member_id, member_congregation
  from public.member_profile_completion_links l
  where l.token_hash = token_hash
    and l.used_at is null
    and l.revoked_at is null
    and l.expires_at > now()
  order by l.created_at desc
  limit 1;

  if link_id is null or member_id is null then
    raise exception 'Este link expirou ou já foi utilizado.';
  end if;

  normalized_cpf := public.normalize_cpf(input_cpf);
  if normalized_cpf is null or not public.is_valid_cpf(normalized_cpf) then
    raise exception 'CPF inválido.';
  end if;

  normalized_rg := nullif(btrim(coalesce(input_rg, '')), '');
  if normalized_rg is null then
    raise exception 'RG é obrigatório.';
  end if;

  normalized_photo_url := nullif(btrim(coalesce(input_photo_url, '')), '');
  normalized_email := nullif(lower(btrim(coalesce(input_email, ''))), '');
  normalized_address := nullif(btrim(coalesce(input_address, '')), '');
  normalized_notes := nullif(btrim(coalesce(input_notes, '')), '');

  if exists (
    select 1
    from public.pessoas p
    where p.congregation_id = member_congregation
      and p.cpf = normalized_cpf
      and p.id <> member_id
  ) then
    raise exception 'Já existe membro com este CPF nesta congregação.';
  end if;

  update public.pessoas p
  set cpf = normalized_cpf,
      rg = normalized_rg,
      foto_url = normalized_photo_url,
      data_nascimento = input_data_nascimento,
      email = normalized_email,
      endereco = normalized_address,
      observacoes = case
        when normalized_notes is null then p.observacoes
        when p.observacoes is null or btrim(p.observacoes) = '' then normalized_notes
        else p.observacoes || E'\n\n[Cadastro completo] ' || normalized_notes
      end,
      cadastro_completo_status = 'concluido',
      cadastro_completo_at = now()
  where p.id = member_id;

  update public.member_profile_completion_links
  set used_at = now()
  where id = link_id;

  update public.member_profile_completion_links
  set revoked_at = now()
  where pessoa_id = member_id
    and id <> link_id
    and used_at is null
    and revoked_at is null;

  perform public.log_timeline(
    member_id,
    'CADASTRO',
    'Cadastro completo finalizado pelo membro',
    jsonb_build_object('source', 'cadastro_completo_link')
  );

  return jsonb_build_object(
    'member_id', member_id,
    'status', 'concluido'
  );
end;
$$;

grant execute on function public.complete_member_registration_by_token(text, text, text, text, date, text, text, text) to anon, authenticated;
