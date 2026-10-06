# Correções da auditoria de 2026-10

## Why

A auditoria `streamline-app` de 2026-10-05 encontrou:

1. **Node do ambiente local:** o Node padrão do sistema é o v12.22.9, que não
   roda `next build`/`next lint` (`SyntaxError: Unexpected token '?'`). O
   projeto não declara a versão de Node que espera.
2. **Vulnerabilidades:** `npm audit` mostra 1 crítica e várias altas. Uma parte
   (`ws`, `nanoid`, `tar`, `supabase` CLI, `brace-expansion`, `js-yaml`…) tem
   correção sem troca de versão principal (`npm audit fix`, sem `--force`).
3. **Código morto:** `src/components/ui/card.tsx`, `ui/separator.tsx` e
   `ui/badge.tsx` não têm nenhum importador (grep por caminho e por símbolo
   exportado; o projeto não tem arquivos barrel `index.ts`).

## What Changes

- Adicionar `.nvmrc` com `20` e `"engines": { "node": ">=20" }` no
  `package.json`.
- Rodar `npm audit fix` (sem `--force`), atualizando só o `package-lock.json`
  dentro dos ranges de versão já declarados.
- Excluir os 3 componentes de UI sem uso.

## Impact

- Nenhuma mudança visível para o usuário.
- **Fora de escopo, fica para propostas próprias:**
  - **Next.js 14 → 15.5.24+.** As CVEs crítica e altas que restam no `next`
    (RCE no Image Optimization com AVIF, SSRF, DoS em Server Components) só
    são corrigidas na 15.5.24+. Isso é troca de versão principal (App Router no
    Next 15 exige React 19, APIs assíncronas de `params`/`cookies`) e merece
    uma migração dedicada. Atenuante: o projeto não usa `next/image` nem
    `middleware.ts`.
  - `tailwindcss` 3 → 4 e `eslint-config-next` 16: também são trocas de versão
    principal, só de ferramentas de desenvolvimento e build.
  - Lógica residual do Discipulado em `api/admin/roles` e `api/admin/users`
    (`DISCIPULADO_ONLY_ROLES`, ramos `!isGlobalAdmin`) e o fallback
    `ADMIN_DISCIPULADO` em `requireUserManagementAdmin`. Mexe nas permissões da
    gestão de usuários e já foi adiada antes por risco
    (`fix-admin-user-management-access`).
  - A página `/conta`, que hoje é um placeholder ("será expandida em breve").
