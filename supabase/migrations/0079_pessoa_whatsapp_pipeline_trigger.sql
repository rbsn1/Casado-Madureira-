-- Ao cadastrar uma pessoa via CCM (ficha ou tela "Adicionar do grupo"),
-- cria/atualiza o contato de WhatsApp e enfileira as duas mensagens de
-- onboarding. Nunca bloqueia o INSERT em pessoas: qualquer falha aqui é
-- só um warning, o cadastro da pessoa é sempre a prioridade.
create or replace function public.sync_pessoa_to_whatsapp_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_digits text;
  v_name text;
  v_dept_names text[];
begin
  if new.cadastro_origem is distinct from 'ccm' then
    return new;
  end if;

  begin
    v_digits := regexp_replace(coalesce(new.telefone_whatsapp, ''), '\D', '', 'g');
    if v_digits = '' or new.congregation_id is null then
      return new;
    end if;

    v_name := coalesce(nullif(trim(new.nome_completo), ''), 'Irmão(ã)');

    insert into public.contacts (tenant_id, name, phone_e164, opt_in_whatsapp)
    values (new.congregation_id, v_name, v_digits, true)
    on conflict (tenant_id, phone_e164)
    do update set name = excluded.name, updated_at = now()
    returning id into v_contact_id;

    insert into public.message_jobs (tenant_id, contact_id, channel, type, status, payload, scheduled_at)
    values (
      new.congregation_id,
      v_contact_id,
      'whatsapp',
      'welcome',
      'PENDENTE',
      jsonb_build_object(
        'to', v_digits,
        'name', v_name,
        'mode', 'template',
        'templateName', 'welcome_ccm'
      ),
      now()
    );

    select coalesce(array_agg(nome order by created_at asc), '{}'::text[])
      into v_dept_names
    from (
      select nome, created_at
      from public.departamentos
      where ativo is true and congregation_id = new.congregation_id
      order by created_at asc
      limit 3
    ) d;

    insert into public.message_jobs (tenant_id, contact_id, channel, type, status, payload, scheduled_at)
    values (
      new.congregation_id,
      v_contact_id,
      'whatsapp',
      'departments',
      'PENDENTE',
      jsonb_build_object(
        'to', v_digits,
        'name', v_name,
        'mode', 'template',
        'templateName', 'departamentos_ccm',
        'templateParams', to_jsonb(array_prepend(v_name, v_dept_names))
      ),
      now() + interval '1 day'
    );
  exception when others then
    raise warning 'sync_pessoa_to_whatsapp_pipeline falhou para pessoa %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_pessoa_to_whatsapp on public.pessoas;
create trigger trg_sync_pessoa_to_whatsapp
after insert on public.pessoas
for each row execute function public.sync_pessoa_to_whatsapp_pipeline();
