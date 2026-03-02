-- Normaliza telefones para E.164 brasileiro no fluxo de cadastro (pessoas -> contacts).

create or replace function public.normalize_phone_e164_br(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');
  if digits = '' then
    return null;
  end if;

  if left(digits, 2) = '55' and (char_length(digits) = 12 or char_length(digits) = 13) then
    return digits;
  end if;

  if char_length(digits) = 10 or char_length(digits) = 11 then
    return '55' || digits;
  end if;

  if char_length(digits) between 8 and 15 then
    return digits;
  end if;

  return null;
end;
$$;

grant execute on function public.normalize_phone_e164_br(text) to authenticated, anon;

create or replace function public.sync_contact_from_pessoa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  normalized_phone text;
  normalized_name text;
begin
  target_tenant_id := coalesce(new.congregation_id, public.get_default_congregation_id());
  normalized_phone := public.normalize_phone_e164_br(new.telefone_whatsapp);
  normalized_name := nullif(btrim(coalesce(new.nome_completo, '')), '');

  if target_tenant_id is null or normalized_phone is null or normalized_name is null then
    return new;
  end if;

  update public.contacts c
  set name = normalized_name,
      opt_in_whatsapp = true,
      updated_at = now()
  where c.tenant_id = target_tenant_id
    and c.phone_e164 = normalized_phone;

  if not found then
    insert into public.contacts (tenant_id, name, phone_e164, opt_in_whatsapp)
    values (target_tenant_id, normalized_name, normalized_phone, true);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_contacts_from_pessoas on public.pessoas;
create trigger trg_sync_contacts_from_pessoas
after insert or update of nome_completo, telefone_whatsapp, congregation_id on public.pessoas
for each row
execute function public.sync_contact_from_pessoa();

update public.contacts c
set phone_e164 = public.normalize_phone_e164_br(c.phone_e164),
    updated_at = now()
where public.normalize_phone_e164_br(c.phone_e164) is not null
  and c.phone_e164 is distinct from public.normalize_phone_e164_br(c.phone_e164);

insert into public.contacts (tenant_id, name, phone_e164, opt_in_whatsapp)
select
  coalesce(p.congregation_id, public.get_default_congregation_id()) as tenant_id,
  btrim(p.nome_completo) as name,
  public.normalize_phone_e164_br(p.telefone_whatsapp) as phone_e164,
  true as opt_in_whatsapp
from public.pessoas p
where nullif(btrim(coalesce(p.nome_completo, '')), '') is not null
  and public.normalize_phone_e164_br(p.telefone_whatsapp) is not null
  and coalesce(p.cadastro_origem, 'ccm') = 'ccm'
  and not exists (
    select 1
    from public.contacts c
    where c.tenant_id = coalesce(p.congregation_id, public.get_default_congregation_id())
      and c.phone_e164 = public.normalize_phone_e164_br(p.telefone_whatsapp)
  );
