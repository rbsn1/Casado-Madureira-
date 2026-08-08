# Tasks — Remover código morto e consolidar slugify

- [ ] Excluir `src/components/LoginPage.tsx`
- [ ] Excluir `src/components/LoginDiscipuladoPremium.tsx`
- [ ] Excluir `src/components/LoginPortalDiscipulado.tsx`
- [ ] Excluir `src/components/StarfieldCanvas.tsx`
- [ ] Excluir `src/lib/demoData.ts`
- [ ] Atualizar `src/app/api/admin/congregations/route.ts` para importar
      `slugify` de `@/lib/slugify` em vez da função inline
- [ ] Atualizar `src/app/api/admin/congregations/[id]/route.ts` para importar
      `slugify` de `@/lib/slugify` em vez da função inline
- [ ] Rodar `npm run build` e `npm run lint` sem erros novos
