-- Permite criação de case por SM_DISCIPULADO sem quebrar no trigger de criticidade.
-- Regra:
-- - DISCIPULADOR: pode recalcular no escopo da própria congregação.
-- - SM_DISCIPULADO: apenas recalcular 1 case específico da própria congregação.

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
  is_sm_discipulado boolean := false;
begin
  if auth.uid() is not null then
    is_discipulador := public.has_role(array['DISCIPULADOR']);
    is_sm_discipulado := public.has_role(array['SM_DISCIPULADO']);

    if not (is_discipulador or is_sm_discipulado) then
      raise exception 'not allowed';
    end if;

    my_congregation := public.get_my_congregation_id();
    if my_congregation is null or not public.is_congregation_active(my_congregation) then
      raise exception 'congregation inactive';
    end if;

    if target_congregation_id is not null and target_congregation_id <> my_congregation then
      raise exception 'not allowed';
    end if;

    if is_sm_discipulado and not is_discipulador then
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
