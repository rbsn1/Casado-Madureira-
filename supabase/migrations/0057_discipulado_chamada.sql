-- Discipulado: estrutura de chamada por turma/aula.

create table if not exists public.discipleship_turmas (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  nome text not null,
  turno text not null
    check (turno in ('MANHA', 'TARDE', 'NOITE', 'NAO_INFORMADO')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (congregation_id, nome)
);

create table if not exists public.discipleship_turma_alunos (
  turma_id uuid not null references public.discipleship_turmas(id) on delete cascade,
  aluno_id uuid not null references public.pessoas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (turma_id, aluno_id)
);

create table if not exists public.discipleship_aulas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.discipleship_turmas(id) on delete cascade,
  data date not null,
  tema text null,
  modulo_id uuid null references public.discipleship_modules(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turma_id, data)
);

create table if not exists public.discipleship_chamada_itens (
  aula_id uuid not null references public.discipleship_aulas(id) on delete cascade,
  aluno_id uuid not null references public.pessoas(id) on delete cascade,
  status text null check (status in ('PRESENTE', 'FALTA', 'JUSTIFICADA') or status is null),
  observacao text null,
  marcado_em timestamptz null,
  marcado_por uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (aula_id, aluno_id)
);

create index if not exists discipleship_turmas_congregation_idx
  on public.discipleship_turmas (congregation_id, turno, ativo);

create index if not exists discipleship_turma_alunos_aluno_idx
  on public.discipleship_turma_alunos (aluno_id);

create index if not exists discipleship_aulas_turma_data_idx
  on public.discipleship_aulas (turma_id, data desc);

create index if not exists discipleship_chamada_itens_status_idx
  on public.discipleship_chamada_itens (aula_id, status);

drop trigger if exists trg_touch_discipleship_turmas on public.discipleship_turmas;
create trigger trg_touch_discipleship_turmas
before update on public.discipleship_turmas
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_discipleship_aulas on public.discipleship_aulas;
create trigger trg_touch_discipleship_aulas
before update on public.discipleship_aulas
for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_discipleship_chamada_itens on public.discipleship_chamada_itens;
create trigger trg_touch_discipleship_chamada_itens
before update on public.discipleship_chamada_itens
for each row execute function public.touch_updated_at();

alter table public.discipleship_turmas enable row level security;
alter table public.discipleship_turma_alunos enable row level security;
alter table public.discipleship_aulas enable row level security;
alter table public.discipleship_chamada_itens enable row level security;

drop policy if exists "discipleship_turmas_read" on public.discipleship_turmas;
create policy "discipleship_turmas_read" on public.discipleship_turmas
for select
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
);

drop policy if exists "discipleship_turmas_manage" on public.discipleship_turmas;
create policy "discipleship_turmas_manage" on public.discipleship_turmas
for all
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
)
with check (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and (
    public.is_admin_master()
    or public.has_role(array['SUPER_ADMIN'])
    or congregation_id = public.get_my_congregation_id()
  )
);

drop policy if exists "discipleship_turma_alunos_read" on public.discipleship_turma_alunos;
create policy "discipleship_turma_alunos_read" on public.discipleship_turma_alunos
for select
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_turmas t
    where t.id = turma_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
);

drop policy if exists "discipleship_turma_alunos_manage" on public.discipleship_turma_alunos;
create policy "discipleship_turma_alunos_manage" on public.discipleship_turma_alunos
for all
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_turmas t
    where t.id = turma_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
)
with check (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_turmas t
    where t.id = turma_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
);

drop policy if exists "discipleship_aulas_read" on public.discipleship_aulas;
create policy "discipleship_aulas_read" on public.discipleship_aulas
for select
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_turmas t
    where t.id = turma_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
);

drop policy if exists "discipleship_aulas_manage" on public.discipleship_aulas;
create policy "discipleship_aulas_manage" on public.discipleship_aulas
for all
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_turmas t
    where t.id = turma_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
)
with check (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_turmas t
    where t.id = turma_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
);

drop policy if exists "discipleship_chamada_itens_read" on public.discipleship_chamada_itens;
create policy "discipleship_chamada_itens_read" on public.discipleship_chamada_itens
for select
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_aulas a
    join public.discipleship_turmas t on t.id = a.turma_id
    where a.id = aula_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
);

drop policy if exists "discipleship_chamada_itens_manage" on public.discipleship_chamada_itens;
create policy "discipleship_chamada_itens_manage" on public.discipleship_chamada_itens
for all
using (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_aulas a
    join public.discipleship_turmas t on t.id = a.turma_id
    where a.id = aula_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
)
with check (
  public.has_role(array[
    'ADMIN_MASTER',
    'SUPER_ADMIN',
    'ADMIN_DISCIPULADO',
    'DISCIPULADOR',
    'SM_DISCIPULADO',
    'SECRETARIA_DISCIPULADO'
  ])
  and exists (
    select 1
    from public.discipleship_aulas a
    join public.discipleship_turmas t on t.id = a.turma_id
    where a.id = aula_id
      and (
        public.is_admin_master()
        or public.has_role(array['SUPER_ADMIN'])
        or t.congregation_id = public.get_my_congregation_id()
      )
  )
);

grant select, insert, update, delete on public.discipleship_turmas to authenticated;
grant select, insert, update, delete on public.discipleship_turma_alunos to authenticated;
grant select, insert, update, delete on public.discipleship_aulas to authenticated;
grant select, insert, update, delete on public.discipleship_chamada_itens to authenticated;
