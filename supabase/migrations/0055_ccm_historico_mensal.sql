-- CCM: histórico agregado mensal para incluir cadastros antigos sem nomes individuais.

create table if not exists public.ccm_cadastros_historico_mensal (
  id bigserial primary key,
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  ano int not null check (ano between 2000 and 2100),
  mes int not null check (mes between 1 and 12),
  total_cadastros int not null check (total_cadastros >= 0),
  fonte text not null default 'planilha',
  created_at timestamptz not null default now(),
  unique (congregation_id, ano, mes)
);

create index if not exists ccm_cadastros_hist_congregation_ano_mes_idx
  on public.ccm_cadastros_historico_mensal (congregation_id, ano, mes);

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
  if session_user <> 'postgres'
     and not public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']) then
    raise exception 'not allowed';
  end if;

  if session_user = 'postgres' then
    effective_congregation := target_congregation_id;
  elsif public.is_admin_master() then
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
      (
        select count(*)
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
          and (start_ts is null or p.created_at >= start_ts)
          and (end_ts is null or p.created_at <= end_ts)
      ) +
      (
        select coalesce(sum(h.total_cadastros), 0)
        from public.ccm_cadastros_historico_mensal h
        where (effective_congregation is null or h.congregation_id = effective_congregation)
          and (start_ts is null or make_date(h.ano, h.mes, 1) >= date_trunc('month', start_ts)::date)
          and (end_ts is null or make_date(h.ano, h.mes, 1) <= date_trunc('month', end_ts)::date)
          and not exists (
            select 1
            from public.pessoas p2
            where (effective_congregation is null or p2.congregation_id = effective_congregation)
              and coalesce(p2.cadastro_origem, 'ccm') = 'ccm'
              and extract(year from p2.created_at)::int = h.ano
              and extract(month from p2.created_at)::int = h.mes
          )
      )
    ),
    'base_total',
    (
      (
        select count(*)
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
      ) +
      (
        select coalesce(sum(h.total_cadastros), 0)
        from public.ccm_cadastros_historico_mensal h
        where (effective_congregation is null or h.congregation_id = effective_congregation)
          and not exists (
            select 1
            from public.pessoas p2
            where (effective_congregation is null or p2.congregation_id = effective_congregation)
              and coalesce(p2.cadastro_origem, 'ccm') = 'ccm'
              and extract(year from p2.created_at)::int = h.ano
              and extract(month from p2.created_at)::int = h.mes
          )
      )
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
        union
        select distinct h.ano
        from public.ccm_cadastros_historico_mensal h
        where (effective_congregation is null or h.congregation_id = effective_congregation)
      ) anos
    ),
    'cadastros_mensais',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('month', m, 'count', coalesce(real.total, 0) + coalesce(hist.total, 0))
          order by m
        ),
        '[]'::jsonb
      )
      from generate_series(1, 12) as m
      left join (
        select extract(month from p.created_at)::int as mes, count(*) as total
        from public.pessoas p
        where (effective_congregation is null or p.congregation_id = effective_congregation)
          and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
          and extract(year from p.created_at)::int = target_year
        group by mes
      ) real on real.mes = m
      left join (
        select h.mes, sum(h.total_cadastros)::bigint as total
        from public.ccm_cadastros_historico_mensal h
        where (effective_congregation is null or h.congregation_id = effective_congregation)
          and h.ano = target_year
          and not exists (
            select 1
            from public.pessoas p2
            where (effective_congregation is null or p2.congregation_id = effective_congregation)
              and coalesce(p2.cadastro_origem, 'ccm') = 'ccm'
              and extract(year from p2.created_at)::int = h.ano
              and extract(month from p2.created_at)::int = h.mes
          )
        group by h.mes
      ) hist on hist.mes = m
    ),
    'ano_selecionado', target_year
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_casados_dashboard(timestamptz, timestamptz, int, uuid) to authenticated;
