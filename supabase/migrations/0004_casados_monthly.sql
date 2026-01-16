-- Adiciona cadastros mensais no dashboard de Casados
drop function if exists public.get_casados_dashboard(timestamptz, timestamptz);

create or replace function public.get_casados_dashboard(
  start_ts timestamptz default null,
  end_ts timestamptz default null,
  year int default null
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
begin
  if not public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS','LIDER_DEPTO']) then
    raise exception 'not allowed';
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
      where (start_ts is null or p.created_at >= start_ts)
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
        where (start_ts is null or p.created_at >= start_ts)
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
        where (start_ts is null or p.created_at >= start_ts)
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
        where (start_ts is null or p.created_at >= start_ts)
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
            where p.created_at >= start_ts and p.created_at <= end_ts
            group by label
            order by total desc
            limit 6
          ) curr
          left join (
            select coalesce(p.bairro, 'Sem bairro') as label, count(*) as total
            from public.pessoas p
            where p.created_at >= start_prev and p.created_at <= end_prev
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
            where p.created_at >= start_ts and p.created_at <= end_ts
            group by label
            order by total desc
            limit 6
          ) curr
          left join (
            select coalesce(p.igreja_origem, 'Sem igreja') as label, count(*) as total
            from public.pessoas p
            where p.created_at >= start_prev and p.created_at <= end_prev
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
      ) anos
    ),
    'cadastros_mensais',
    (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'count', coalesce(t.total, 0)) order by m), '[]'::jsonb)
      from generate_series(1, 12) as m
      left join (
        select extract(month from p.created_at)::int as mes, count(*) as total
        from public.pessoas p
        where extract(year from p.created_at)::int = target_year
        group by mes
      ) t on t.mes = m
    ),
    'ano_selecionado', target_year
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_casados_dashboard(timestamptz, timestamptz, int) to authenticated;
