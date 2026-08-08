# Tasks — Remover módulo de Escala de Domingo

- [x] Remover import/uso de `SundayScalePortalTrackingCard` em `(public)/login/page.tsx`
- [x] Excluir `src/app/(app)/escalas-domingo/page.tsx`
- [x] Excluir `src/app/(app)/minhas-escalas/page.tsx`
- [x] Excluir `src/app/api/escalas-domingo/public-tracking/route.ts`
- [x] Excluir `src/app/api/escalas-domingo/usuarios/route.ts`
- [x] Excluir diretório `src/components/sunday-scale/`
- [x] Excluir `src/lib/sundayServiceScale.ts`
- [x] Remover entrada de menu "Escala" de `src/components/layout/AppShell.tsx`
- [x] Buscar por referências remanescentes (`sunday-scale`, `escalas-domingo`,
      `SundayScale`, `minhas-escalas`, `?next=/minhas-escalas`) em todo `src` e limpar
- [x] Criar migration de reversão `0074_revert_sunday_service_scale_panel.sql`
      (revoga grants e derruba tabelas/funções de 0071; não aplicada no banco —
      requer ação manual do usuário, ex. `supabase db push`)
- [x] Rodar `npm run build` e `npm run lint` sem erros de import quebrado
