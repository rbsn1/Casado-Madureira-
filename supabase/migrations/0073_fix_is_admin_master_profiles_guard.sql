-- A migration 0016 já foi aplicada neste ambiente com uma proteção
-- insuficiente (checava só se public.profiles existia, não se a coluna
-- role era do tipo esperado). Como o Supabase não reaplica migrations já
-- registradas, corrigimos aqui com uma nova definição da função.
create or replace function public.is_admin_master()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_admin boolean := false;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and data_type = 'text'
  ) then
    execute
      'select exists (
         select 1
         from public.profiles p
         where p.id = auth.uid()
           and p.role = ''admin''
       )'
    into profile_admin;
  end if;

  return profile_admin or public.has_role(array['ADMIN_MASTER', 'SUPER_ADMIN']);
end;
$$;

grant execute on function public.is_admin_master() to authenticated;
