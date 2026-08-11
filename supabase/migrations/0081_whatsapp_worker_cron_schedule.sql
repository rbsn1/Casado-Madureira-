-- Varredura de segurança a cada 5 minutos: pega jobs que venceram (ex.: a
-- mensagem de departamentos, agendada pra +1 dia) e qualquer coisa que o
-- trigger de dispatch imediato (0080) não tenha pego.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'whatsapp-worker-sweep') then
    perform cron.unschedule('whatsapp-worker-sweep');
  end if;
end $$;

select cron.schedule(
  'whatsapp-worker-sweep',
  '*/5 * * * *',
  $$select public.dispatch_whatsapp_worker();$$
);
