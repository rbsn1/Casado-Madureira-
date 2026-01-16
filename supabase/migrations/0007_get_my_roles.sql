create or replace function public.get_my_roles()
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(role order by role), '{}')
  from public.usuarios_perfis
  where user_id = auth.uid()
    and active is true;
$$;

grant execute on function public.get_my_roles() to authenticated;
