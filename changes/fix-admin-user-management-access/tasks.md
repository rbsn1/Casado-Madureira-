# Tasks — Corrigir acesso de ADMIN_MASTER à gestão de usuários

- [x] `src/lib/serverAuth.ts`: adicionar bypass ADMIN_MASTER/SUPER_ADMIN em
      `requireDiscipuladoAdmin`, tratado como admin global
- [x] Renomear `requireDiscipuladoAdmin` → `requireUserManagementAdmin` em
      `serverAuth.ts`
- [x] Atualizar import/uso em `src/app/api/admin/users/route.ts`
- [x] Atualizar import/uso em `src/app/api/admin/roles/route.ts`
- [x] Remover as 4 roles do Discipulado de `roleOptions` em
      `src/app/(app)/admin/page.tsx`
- [x] Rodar `npm run build` e `npm run lint` sem erros novos
