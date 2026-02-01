-- Contatos públicos de departamentos (para chat de dúvidas)
create table if not exists public.departamentos_publicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  responsavel text,
  contato text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.departamentos_publicos enable row level security;

drop policy if exists "departamentos_publicos_read" on public.departamentos_publicos;
drop policy if exists "departamentos_publicos_manage" on public.departamentos_publicos;

create policy "departamentos_publicos_read" on public.departamentos_publicos
  for select
  using (true);

create policy "departamentos_publicos_manage" on public.departamentos_publicos
  for all
  using (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']))
  with check (public.has_role(array['ADMIN_MASTER','PASTOR','SECRETARIA']));

drop trigger if exists trg_touch_departamentos_publicos on public.departamentos_publicos;
create trigger trg_touch_departamentos_publicos before update on public.departamentos_publicos
for each row execute function public.touch_updated_at();

create index if not exists departamentos_publicos_ativo_idx
  on public.departamentos_publicos (ativo);
