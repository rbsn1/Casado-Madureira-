alter table public.departamentos
  add column if not exists type text not null default 'simple' check (type in ('simple', 'colegiado', 'umbrella', 'mixed')),
  add column if not exists parent_id uuid null references public.departamentos(id) on delete set null;

create index if not exists departamentos_parent_id_idx on public.departamentos(parent_id);
