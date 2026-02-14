-- Evita bloqueio de criação de case quando a congregação ainda não possui módulos ativos.
-- Estratégia:
-- 1) tentar clonar módulos ativos da congregação padrão;
-- 2) se não houver template, criar os 4 módulos padrão;
-- 3) manter a validação final de segurança.

create or replace function public.ensure_discipleship_case_has_active_modules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_congregation uuid;
begin
  select p.congregation_id
  into resolved_congregation
  from public.pessoas p
  where p.id = new.member_id;

  new.congregation_id := coalesce(
    new.congregation_id,
    resolved_congregation,
    public.get_my_congregation_id(),
    public.current_congregation_id_or_default()
  );

  if new.congregation_id is null then
    raise exception 'Não foi possível determinar a congregação do discipulado.';
  end if;

  if not exists (
    select 1
    from public.discipleship_modules m
    where m.congregation_id = new.congregation_id
      and m.is_active is true
  ) then
    insert into public.discipleship_modules (congregation_id, title, description, sort_order, is_active)
    select
      new.congregation_id,
      m.title,
      m.description,
      m.sort_order,
      true
    from public.discipleship_modules m
    where m.congregation_id = public.get_default_congregation_id()
      and m.is_active is true
    on conflict (congregation_id, title) do update
      set is_active = true;
  end if;

  if not exists (
    select 1
    from public.discipleship_modules m
    where m.congregation_id = new.congregation_id
      and m.is_active is true
  ) then
    insert into public.discipleship_modules (congregation_id, title, description, sort_order, is_active)
    values
      (new.congregation_id, 'Fundamentos da Fé', 'Base bíblica e doutrinária para novos convertidos.', 1, true),
      (new.congregation_id, 'Vida Devocional', 'Prática de oração, leitura bíblica e disciplina espiritual.', 2, true),
      (new.congregation_id, 'Comunhão e Serviço', 'Integração saudável na igreja local e cultura de serviço.', 3, true),
      (new.congregation_id, 'Visão e Missão', 'Compreensão da visão da igreja e responsabilidade missionária.', 4, true)
    on conflict (congregation_id, title) do update
      set is_active = true;
  end if;

  if not exists (
    select 1
    from public.discipleship_modules m
    where m.congregation_id = new.congregation_id
      and m.is_active is true
  ) then
    raise exception 'Esta congregação não possui módulos ativos de discipulado.';
  end if;

  return new;
end;
$$;
