# Tasks — Refatorar admin/page.tsx

- [x] Criar `src/lib/adminApi.ts` com `apiFetch`
- [x] Criar `src/components/admin/UsersSection.tsx`
- [x] Criar `src/components/admin/LoginBackgroundSection.tsx`
- [x] Criar `src/components/admin/SpecialEventSection.tsx`
- [x] Criar `src/components/admin/WeeklyAgendaSection.tsx`
- [x] Reescrever `admin/page.tsx` como composição dos 4 componentes
      (954 → 20 linhas)
- [x] Rodar `npm run build` e `npm run lint` sem erros novos
- [x] Registrado: verificação funcional dos 4 formulários (criar usuário,
      trocar papel de parede, salvar evento especial, CRUD de agenda)
      fica pendente de validação manual pelo usuário — sem ambiente com
      credenciais reais neste sandbox
