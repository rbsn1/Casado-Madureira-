-- CCM: separar origem de cadastro para não contabilizar registros criados no Discipulado.

-- 1) Origem do cadastro em pessoas.
alter table public.pessoas
  add column if not exists cadastro_origem text;

update public.pessoas
set cadastro_origem = 'ccm'
where cadastro_origem is null;

alter table public.pessoas
  alter column cadastro_origem set default 'ccm',
  alter column cadastro_origem set not null;

alter table public.pessoas
  drop constraint if exists pessoas_cadastro_origem_check;

alter table public.pessoas
  add constraint pessoas_cadastro_origem_check
  check (cadastro_origem in ('ccm', 'discipulado'));

create index if not exists pessoas_cadastro_origem_created_at_idx
  on public.pessoas (cadastro_origem, created_at desc);

-- 2) Dashboard CCM deve contar somente cadastro_origem='ccm'.
create or replace function public.get_casados_dashboard(
  start_ts timestamptz default null,
  end_ts timestamptz default null,
  year int default null,
  target_congregation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_prev timestamptz;
  end_prev timestamptz;
  result jsonb;
  target_year int := coalesce(year, extract(year from now())::int);
  effective_congregation uuid;
begin
  if not public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  if start_ts is not null and end_ts is not null then
    start_prev := start_ts - (end_ts - start_ts);
    end_prev := start_ts;
  end if;

  select jsonb_build_object(
    'total',
    (
      select count(*)
      from public.pessoas p
      where (effective_congregation is null or p.congregation_id = effective_congregation)
        and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
        and (start_ts is null or p.created_at >= start_ts)
        and (end_ts is null or p.created_at <= end_ts)
    ),
    'origem',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', origem, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select
          case
            when p.origem ilike '%manh%' then 'Manhã'
            when p.origem ilike '%noite%' then 'Noite'
            when p.origem ilike '%evento%' then 'Evento'
            when p.origem ilike '%celula%' or p.origem ilike '%célula%' then 'Célula'
            else 'Outro'
          end as origem,
          count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
          and (start_ts is null or p.created_at >= start_ts)
          and (end_ts is null or p.created_at <= end_ts)
        group by origem
        order by total desc
      ) dados
    ),
    'igrejas',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', igreja, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select coalesce(p.igreja_origem, 'Sem igreja') as igreja, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
          and (start_ts is null or p.created_at >= start_ts)
          and (end_ts is null or p.created_at <= end_ts)
        group by igreja
        order by total desc
        limit 6
      ) dados
    ),
    'bairros',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', bairro, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select coalesce(p.bairro, 'Sem bairro') as bairro, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
          and (start_ts is null or p.created_at >= start_ts)
          and (end_ts is null or p.created_at <= end_ts)
        group by bairro
        order by total desc
        limit 6
      ) dados
    ),
    'crescimento_bairros',
    (
      case
        when start_prev is null or end_prev is null then '[]'::jsonb
        else (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'label', curr.label,
              'current', curr.total,
              'previous', coalesce(prev.total, 0),
              'delta', curr.total - coalesce(prev.total, 0),
              'delta_pct', case
                when coalesce(prev.total, 0) = 0 then null
                else round(((curr.total - prev.total)::numeric / prev.total) * 100, 1)
              end
            )
            order by curr.total desc
          ), '[]'::jsonb)
          from (
            select coalesce(p.bairro, 'Sem bairro') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
              and p.created_at >= start_ts
              and p.created_at <= end_ts
            group by label
            order by total desc
            limit 6
          ) curr
          left join (
            select coalesce(p.bairro, 'Sem bairro') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
              and p.created_at >= start_prev
              and p.created_at <= end_prev
            group by label
          ) prev
          using (label)
        )
      end
    ),
    'crescimento_igrejas',
    (
      case
        when start_prev is null or end_prev is null then '[]'::jsonb
        else (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'label', curr.label,
              'current', curr.total,
              'previous', coalesce(prev.total, 0),
              'delta', curr.total - coalesce(prev.total, 0),
              'delta_pct', case
                when coalesce(prev.total, 0) = 0 then null
                else round(((curr.total - prev.total)::numeric / prev.total) * 100, 1)
              end
            )
            order by curr.total desc
          ), '[]'::jsonb)
          from (
            select coalesce(p.igreja_origem, 'Sem igreja') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
              and p.created_at >= start_ts
              and p.created_at <= end_ts
            group by label
            order by total desc
            limit 6
          ) curr
          left join (
            select coalesce(p.igreja_origem, 'Sem igreja') as label, count(*) as total
            from public.pessoas p
            where (effective_congregation is null or p.congregation_id = effective_congregation)
              and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
              and p.created_at >= start_prev
              and p.created_at <= end_prev
            group by label
          ) prev
          using (label)
        )
      end
    ),
    'anos_disponiveis',
    (
      select coalesce(jsonb_agg(ano order by ano desc), '[]'::jsonb)
      from (
        select distinct extract(year from p.created_at)::int as ano
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
      ) anos
    ),
    'cadastros_mensais',
    (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', coalesce(t.total, 0)) order by m), '[]'::jsonb)
      from generate_series(1, 12) as m
      left join (
        select extract(month from p.created_at)::int as mes, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
          and extract(year from p.created_at)::int = target_year
        group by mes
      ) t on t.mes = m
    ),
    'ano_selecionado', target_year
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_casados_dashboard(timestamptz, timestamptz, int, uuid) to authenticated;

-- 3) Dashboard Novos Convertidos: cadastros apenas do CCM.
create or replace function public.get_novos_dashboard(
  start_ts timestamptz default null,
  end_ts timestamptz default null,
  year int default null,
  target_congregation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  target_year int := coalesce(year, extract(year from now())::int);
  effective_congregation uuid;
begin
  if not public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']) then
    raise exception 'not allowed';
  end if;

  if public.is_admin_master() then
    effective_congregation := target_congregation_id;
  else
    effective_congregation := public.get_my_congregation_id();
  end if;

  select jsonb_build_object(
    'funnel',
    (
      select jsonb_build_array(
        jsonb_build_object('label','Cadastros recebidos','value',(
          select count(*) from public.pessoas p
          where (effective_congregation is null or p.congregation_id = effective_congregation)
            and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
            and (start_ts is null or p.created_at >= start_ts)
            and (end_ts is null or p.created_at <= end_ts)
        )),
        jsonb_build_object('label','Encaminhados','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'PENDENTE'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Contato iniciado','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'CONTATO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Acompanhamento','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'EM_ANDAMENTO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Integrados','value',(
          select count(*) from public.integracao_novos_convertidos i
          where (effective_congregation is null or i.congregation_id = effective_congregation)
            and i.status = 'INTEGRADO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Batizados','value',(
          select count(*) from public.batismos b
          where (effective_congregation is null or b.congregation_id = effective_congregation)
            and (start_ts is null or b.data >= start_ts::date)
            and (end_ts is null or b.data <= end_ts::date)
        ))
      )
    ),
    'voluntariado',
    (
      select coalesce(jsonb_agg(jsonb_build_object('label', depto, 'count', total) order by total desc), '[]'::jsonb)
      from (
        select d.nome as depto, count(pd.id) as total
        from public.departamentos d
        left join public.pessoa_departamento pd
          on pd.departamento_id = d.id
         and coalesce(pd.status,'ATIVO') <> 'INATIVO'
        where (effective_congregation is null or d.congregation_id = effective_congregation)
          and d.ativo is true
        group by d.nome
        order by total desc
        limit 6
      ) dados
    ),
    'destaques',
    jsonb_build_object(
      'contatos_7d', (
        select count(*)
        from public.eventos_timeline e
        where (effective_congregation is null or e.congregation_id = effective_congregation)
          and e.tipo = 'CONTATO'
          and e.created_at >= now() - interval '7 days'
      ),
      'departamentos_ativos', (
        select count(*)
        from public.departamentos d
        where (effective_congregation is null or d.congregation_id = effective_congregation)
          and d.ativo is true
      ),
      'batismos_30d', (
        select count(*)
        from public.batismos b
        where (effective_congregation is null or b.congregation_id = effective_congregation)
          and b.data >= current_date
          and b.data <= current_date + interval '30 days'
      )
    ),
    'pendencias',
    jsonb_build_object(
      'pendente_7d', (
        select count(*)
        from public.integracao_novos_convertidos i
        where (effective_congregation is null or i.congregation_id = effective_congregation)
          and i.status in ('PENDENTE','CONTATO')
          and coalesce(i.ultima_interacao, i.created_at) < now() - interval '7 days'
      ),
      'pendente_14d', (
        select count(*)
        from public.integracao_novos_convertidos i
        where (effective_congregation is null or i.congregation_id = effective_congregation)
          and i.status in ('PENDENTE','CONTATO')
          and coalesce(i.ultima_interacao, i.created_at) < now() - interval '14 days'
      )
    ),
    'anos_disponiveis',
    (
      select coalesce(jsonb_agg(ano order by ano desc), '[]'::jsonb)
      from (
        select distinct extract(year from p.created_at)::int as ano
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
      ) anos
    ),
    'cadastros_mensais',
    (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', coalesce(t.total, 0)) order by m), '[]'::jsonb)
      from generate_series(1, 12) as m
      left join (
        select extract(month from p.created_at)::int as mes, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
          and extract(year from p.created_at)::int = target_year
        group by mes
      ) t on t.mes = m
    ),
    'ano_selecionado', target_year
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_novos_dashboard(timestamptz, timestamptz, int, uuid) to authenticated;

-- 4) Lista do Discipulado com membros do CCM somente.
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
  if not public.has_role(array['ADMIN_DISCIPULADO', 'DISCIPULADOR', 'SM_DISCIPULADO', 'SECRETARIA_DISCIPULADO']) then
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
        and dc.status in ('pendente_matricula', 'em_discipulado', 'pausado')
    ) as has_active_case
  from public.pessoas p
  where p.congregation_id = effective_congregation
    and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
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

-- 5) Cadastro criado no fluxo Discipulado deve ficar marcado como discipulado.
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
    igreja_origem,
    bairro,
    observacoes,
    congregation_id,
    cadastro_origem,
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
    'discipulado',
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
