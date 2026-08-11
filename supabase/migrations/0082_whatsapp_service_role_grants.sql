-- Achado durante a implementação: service_role nunca recebeu GRANT nas
-- tabelas do pipeline de WhatsApp (message_jobs, contacts,
-- church_settings), só anon/authenticated/postgres tinham acesso. Isso é
-- pré-existente — não foi causado pelas migrations 0077-0081 — mas é o
-- motivo real do "permission denied for table message_jobs" que a
-- smooth-worker (que usa SUPABASE_SERVICE_ROLE_KEY) recebia. service_role
-- ignora RLS por atributo de role, mas ainda precisa do GRANT de tabela.
grant select, insert, update, delete on public.message_jobs to service_role;
grant select, insert, update, delete on public.contacts to service_role;
grant select, insert, update, delete on public.church_settings to service_role;
