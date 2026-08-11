-- Dispara a Edge Function smooth-worker via pg_net, autenticando com o
-- token guardado no Vault. Não bloqueia o chamador (net.http_post é
-- assíncrono) e nunca lança exceção — se o token não existir ou a chamada
-- falhar, só registra um warning.
create or replace function public.dispatch_whatsapp_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_token text;
  worker_url text := 'https://uquhgeunncbjgiqljhgw.supabase.co/functions/v1/smooth-worker';
begin
  select decrypted_secret into worker_token
  from vault.decrypted_secrets
  where name = 'whatsapp_worker_token'
  limit 1;

  if worker_token is null then
    raise warning 'dispatch_whatsapp_worker: whatsapp_worker_token não encontrado no Vault.';
    return;
  end if;

  perform net.http_post(
    url := worker_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-WORKER-TOKEN', worker_token
    ),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'dispatch_whatsapp_worker falhou: %', sqlerrm;
end;
$$;

grant execute on function public.dispatch_whatsapp_worker() to postgres, authenticated;
