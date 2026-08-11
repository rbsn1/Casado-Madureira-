-- Habilita extensões usadas pelo disparo automático de mensagens de
-- onboarding (webhook + varredura periódica via pg_cron, armazenamento
-- seguro do worker token via Vault).
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;

-- Libera o novo tipo de job para a mensagem de departamentos.
alter table public.message_jobs drop constraint if exists message_jobs_type_check;
alter table public.message_jobs
  add constraint message_jobs_type_check
  check (type in ('welcome', 'departments'));

-- Evita contatos duplicados por congregação e permite upsert idempotente
-- a partir do trigger de pessoas.
alter table public.contacts drop constraint if exists contacts_tenant_phone_key;
alter table public.contacts
  add constraint contacts_tenant_phone_key unique (tenant_id, phone_e164);
