-- Atualiza dashboard de Novos Convertidos com cadastros mensais
drop function if exists public.get_novos_dashboard(timestamptz, timestamptz);

create or replace function public.get_novos_dashboard(
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
  result jsonb;
  target_year int := coalesce(year, extract(year from now())::int);
begin
  if not public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA','NOVOS_CONVERTIDOS']) then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    'funnel',
    (
      select jsonb_build_array(
        jsonb_build_object('label','Cadastros recebidos','value',(
          select count(*) from public.pessoas p
          where (start_ts is null or p.created_at >= start_ts)
            and (end_ts is null or p.created_at <= end_ts)
        )),
        jsonb_build_object('label','Encaminhados','value',(
          select count(*) from public.integracao_novos_convertidos i
          where i.status = 'PENDENTE'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Contato iniciado','value',(
          select count(*) from public.integracao_novos_convertidos i
          where i.status = 'CONTATO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Acompanhamento','value',(
          select count(*) from public.integracao_novos_convertidos i
          where i.status = 'EM_ANDAMENTO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Integrados','value',(
          select count(*) from public.integracao_novos_convertidos i
          where i.status = 'INTEGRADO'
            and (start_ts is null or i.created_at >= start_ts)
            and (end_ts is null or i.created_at <= end_ts)
        )),
        jsonb_build_object('label','Batizados','value',(
          select count(*) from public.batismos b
          where (start_ts is null or b.data >= start_ts::date)
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
        left join public.pessoa_departamento pd on pd.departamento_id = d.id and coalesce(pd.status,'ATIVO') <> 'INATIVO'
        where d.ativo is true
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
        where e.tipo = 'CONTATO'
          and e.created_at >= now() - interval '7 days'
      ),
      'departamentos_ativos', (
        select count(*) from public.departamentos d where d.ativo is true
      ),
      'batismos_30d', (
        select count(*)
        from public.batismos b
        where b.data >= current_date
          and b.data <= current_date + interval '30 days'
      )
    ),
    'pendencias',
    jsonb_build_object(
      'pendente_7d', (
        select count(*)
        from public.integracao_novos_convertidos i
        where i.status in ('PENDENTE','CONTATO')
          and coalesce(i.ultima_interacao, i.created_at) < now() - interval '7 days'
      ),
      'pendente_14d', (
        select count(*)
        from public.integracao_novos_convertidos i
        where i.status in ('PENDENTE','CONTATO')
          and coalesce(i.ultima_interacao, i.created_at) < now() - interval '14 days'
      )
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

grant execute on function public.get_novos_dashboard(timestamptz, timestamptz, int) to authenticated;
