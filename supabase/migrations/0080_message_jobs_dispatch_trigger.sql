-- Dispara a smooth-worker imediatamente sempre que um job é enfileirado.
-- A própria smooth-worker já filtra scheduled_at <= now(), então é seguro
-- disparar mesmo para jobs agendados no futuro (ex.: o de departamentos,
-- +1 dia) — ela simplesmente não vai encontrar nada pra processar ainda,
-- e o pg_cron (migration seguinte) pega quando a data chegar.
create or replace function public.trigger_dispatch_on_message_job_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_whatsapp_worker();
  return new;
end;
$$;

drop trigger if exists trg_dispatch_on_message_job_insert on public.message_jobs;
create trigger trg_dispatch_on_message_job_insert
after insert on public.message_jobs
for each row execute function public.trigger_dispatch_on_message_job_insert();
