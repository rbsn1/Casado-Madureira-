-- Discipulado Admin: índice para acelerar listagem de usuários com filtros por congregação/papel.
-- Consulta alvo (API admin/users): filtros em congregation_id, role, active e junção por user_id.

create index if not exists usuarios_perfis_congregation_role_active_user_idx
  on public.usuarios_perfis (congregation_id, role, active, user_id);
