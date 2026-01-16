-- Novos campos para evangelismo
alter table public.pessoas
  add column if not exists igreja_origem text,
  add column if not exists bairro text,
  add column if not exists cidade text default 'Manaus',
  add column if not exists uf text default 'AM';

-- Função: dashboard Casados com foco em evangelismo
create or replace function public.get_casados_dashboard(start_ts timestamptz default null, end_ts timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  start_prev timestamptz;
  end_prev timestamptz;
  result jsonb;
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
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_casados_dashboard(timestamptz, timestamptz) to authenticated;

-- Função: dashboard Novos Convertidos (operacional)
create or replace function public.get_novos_dashboard(start_ts timestamptz default null, end_ts timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
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
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function public.get_novos_dashboard(timestamptz, timestamptz) to authenticated;
