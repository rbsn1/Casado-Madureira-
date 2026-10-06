# Remover a funcionalidade de agenda semanal

## Why

A agenda semanal era gerenciada em **dois lugares** que faziam o mesmo CRUD na
tabela `weekly_schedule_events`:

- `src/app/(app)/admin/agenda-semanal/page.tsx` (445 linhas, menu "Agenda
  semanal", só `ADMIN_MASTER`);
- `src/components/admin/WeeklyAgendaSection.tsx` (383 linhas), embutido em
  `/admin`.

A agenda pública (`src/app/(public)/agenda/page.tsx`, 248 linhas) lia a mesma
tabela, mas não tem nenhum link apontando para ela no app.

Decisão do usuário (2026-10-05): a funcionalidade inteira sai do sistema.

Achado relacionado, mesma família: `src/components/admin/SpecialEventSection.tsx`
(241 linhas) grava a chave `special_event` em `app_settings`, mas **nada no código
lê essa chave**. É um painel de "evento especial" que configura algo que nenhuma
tela exibe, então sai junto.

## What Changes

- Excluir:
  - `src/app/(app)/admin/agenda-semanal/page.tsx`
  - `src/app/(public)/agenda/page.tsx`
  - `src/components/admin/WeeklyAgendaSection.tsx`
  - `src/components/admin/SpecialEventSection.tsx`
- `src/app/(app)/admin/page.tsx`: remover os imports e o uso das duas seções.
- `src/components/layout/AppShell.tsx`: remover o item de menu "Agenda semanal",
  o glifo `agenda` e as regras de `getNavGlyph` que só existiam para rotas
  removidas (`/agenda`, `/escalas`, `/confraternizacao`).
- `src/app/globals.css`: remover `.agenda-card` e `@keyframes agendaShine`
  (nenhum uso restante).
- Nova migration `0086_remove_weekly_schedule.sql`:
  - `drop table if exists public.weekly_schedule_events` (sem `cascade`: se
    algo no banco ainda depender dela, a migration falha e faz rollback em vez
    de derrubar o dependente silenciosamente);
  - `delete from public.app_settings where key = 'special_event'`.

## Impact

- Some do menu o item "Agenda semanal". A tela `/admin` perde as seções "Evento
  especial" e "Agenda semanal". A URL pública `/agenda` passa a dar 404.
- **Dados:** a migration apaga de forma permanente os eventos cadastrados na
  agenda e a configuração do evento especial. **O arquivo é só criado; aplicar
  no banco (`supabase db push`) é um passo separado que precisa de autorização
  explícita**, precedido de `--dry-run` e de uma checagem em `pg_depend` para
  confirmar que nada mais no banco referencia a tabela.
- Fora de escopo: a origem `EVENTO_ESPECIAL` em `src/lib/cultoOrigem.ts`. Ela
  é uma origem de culto do cadastro de pessoas, não tem relação com o painel de
  evento especial e continua.
- Spec a atualizar no archive: `specs/admin/spec.md` (criar, se não existir).
