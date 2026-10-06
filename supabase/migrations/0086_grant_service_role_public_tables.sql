-- Concede grants ao role service_role em todas as tabelas do schema public.
--
-- A migration 0072 concedeu grants apenas para anon e authenticated.
-- O Supabase JS client inicializado com a service role key autentica via
-- PostgREST como o role 'service_role', que também precisa de GRANT explícito
-- para leitura e escrita nas tabelas — mesmo que RLS seja bypassado por ele.
-- Sem esse grant, operações administrativas (criar usuário, atribuir role, etc.)
-- falhavam com "permission denied for table usuarios_perfis".

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
