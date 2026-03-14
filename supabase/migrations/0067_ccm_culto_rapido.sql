-- CCM: atualiza o cadastro rapido para culto padronizado e complementar depois.

create or replace function public.normalize_pessoa_culto_origem(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := upper(
    regexp_replace(
      translate(
        coalesce(btrim(raw_value), ''),
        'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^A-Z0-9]+',
      ' ',
      'g'
    )
  );
  normalized := btrim(normalized);

  if normalized = '' then
    return null;
  end if;

  if normalized = 'DOMINGO MANHA'
    or normalized = 'MANHA'
    or normalized like '%CULTO DA MANHA%'
    or (normalized like '%DOMINGO%' and normalized like '%MANHA%') then
    return 'DOMINGO_MANHA';
  end if;

  if normalized = 'DOMINGO NOITE'
    or normalized = 'NOITE'
    or normalized like '%CULTO DA NOITE%'
    or (normalized like '%DOMINGO%' and normalized like '%NOITE%') then
    return 'DOMINGO_NOITE';
  end if;

  if normalized = 'QUARTA' or normalized like '%QUARTA%' then
    return 'QUARTA';
  end if;

  if normalized = 'SEXTA'
    or normalized = 'MJ'
    or normalized like '%CULTO DO MJ%'
    or normalized like '%SEXTA%' then
    return 'SEXTA';
  end if;

  if normalized = 'CONGRESSO' or normalized like '%CONGRESSO%' then
    return 'CONGRESSO';
  end if;

  if normalized = 'EVENTO ESPECIAL'
    or normalized like '%EVENTO ESPECIAL%'
    or normalized like '%EVENTO%' then
    return 'EVENTO_ESPECIAL';
  end if;

  if normalized = 'OUTRO'
    or normalized = 'OUTROS'
    or normalized like '%OUTRO%'
    or normalized like '%CELULA%'
    or normalized like '%TARDE%' then
    return 'OUTRO';
  end if;

  return null;
end;
$$;

create or replace function public.culto_origem_to_legacy_label(raw_value text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text := public.normalize_pessoa_culto_origem(raw_value);
begin
  if normalized = 'DOMINGO_MANHA' then
    return 'Domingo manhã';
  end if;
  if normalized = 'DOMINGO_NOITE' then
    return 'Domingo noite';
  end if;
  if normalized = 'QUARTA' then
    return 'Quarta';
  end if;
  if normalized = 'SEXTA' then
    return 'Sexta';
  end if;
  if normalized = 'EVENTO_ESPECIAL' then
    return 'Evento especial';
  end if;
  if normalized = 'CONGRESSO' then
    return 'Congresso';
  end if;
  if normalized = 'OUTRO' then
    return 'Outro';
  end if;
  return null;
end;
$$;

create or replace function public.sync_pessoa_culto_origem()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.culto_origem := public.normalize_pessoa_culto_origem(coalesce(new.culto_origem, new.origem));

  if (new.origem is null or btrim(new.origem) = '') and new.culto_origem is not null then
    new.origem := public.culto_origem_to_legacy_label(new.culto_origem);
  end if;

  return new;
end;
$$;

update public.pessoas p
set culto_origem = public.normalize_pessoa_culto_origem(coalesce(p.culto_origem, p.origem))
where p.culto_origem is distinct from public.normalize_pessoa_culto_origem(coalesce(p.culto_origem, p.origem));

alter table public.pessoas
  drop constraint if exists pessoas_culto_origem_check;

alter table public.pessoas
  add constraint pessoas_culto_origem_check
  check (
    culto_origem in (
      'DOMINGO_MANHA',
      'DOMINGO_NOITE',
      'QUARTA',
      'SEXTA',
      'EVENTO_ESPECIAL',
      'CONGRESSO',
      'OUTRO'
    )
    or culto_origem is null
  );
