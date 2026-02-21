-- Data de acolhimento no case de discipulado.
-- Mantém mudança aditiva e compatível com ambientes existentes.

alter table public.discipleship_cases
  add column if not exists welcomed_on date null;
