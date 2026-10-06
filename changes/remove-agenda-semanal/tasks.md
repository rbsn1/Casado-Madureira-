# Tasks: Remover agenda semanal

- [x] Excluir `src/app/(app)/admin/agenda-semanal/page.tsx`
- [x] Excluir `src/app/(public)/agenda/page.tsx`
- [x] Excluir `src/components/admin/WeeklyAgendaSection.tsx` e `SpecialEventSection.tsx`
- [x] Atualizar `src/app/(app)/admin/page.tsx`
- [x] Atualizar `src/components/layout/AppShell.tsx` (menu, glifo, getNavGlyph)
- [x] Remover `.agenda-card`/`agendaShine` de `src/app/globals.css`
- [x] Criar `supabase/migrations/0086_remove_weekly_schedule.sql` (sem aplicar)
- [x] Rodar build e lint no Node 20 sem erros novos
- [ ] (Separado, com autorização) checar `pg_depend`, `supabase db push --dry-run` e depois o push
