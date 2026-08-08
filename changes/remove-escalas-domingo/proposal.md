# Remover módulo de Escala de Domingo (portal + gestão interna)

## Why

O módulo de escala de domingo (`sunday-scale` / `escalas-domingo`) teve um histórico de
alta instabilidade nos últimos commits: adicionado, restaurado, movido de menu e exposto
no login público em uma sequência curta de mudanças (`Add Sunday scale panel to portal
dashboard`, `Add Sunday scale tracking to portal home`, `Move Sunday scale management to
dedicated menu`, `Restore Sunday scale tracking on login page`, `Expose Sunday scale
tracking on login page`, `Add scale confirmation redirect for pending users`). Isso indica
que a feature não estabilizou e não é mais desejada no produto. Removê-la agora, antes da
reformulação de arquitetura seguir adiante, evita carregar essa complexidade para os
próximos módulos.

Esta é uma remoção de **produto** (funcionalidade completa, pública e interna), distinta
da mudança em `changes/refactor-cadastros-page` (que é só reorganização estrutural de
`cadastros`, sem remover nada).

## What Changes

- Remover o card público do login: import/uso de `SundayScalePortalTrackingCard` em
  `src/app/(public)/login/page.tsx`.
- Remover as páginas autenticadas: `src/app/(app)/escalas-domingo/page.tsx` e
  `src/app/(app)/minhas-escalas/page.tsx`.
- Remover as rotas de API: `src/app/api/escalas-domingo/public-tracking/route.ts` e
  `src/app/api/escalas-domingo/usuarios/route.ts`.
- Remover os componentes: `src/components/sunday-scale/` (AssignmentsTable,
  PortalSection, PortalTrackingCard, PresenceStatusBadge, SummaryCards).
- Remover `src/lib/sundayServiceScale.ts`.
- Remover a entrada de menu "Escala" em `src/components/layout/AppShell.tsx:40`.
- Revisar e limpar quaisquer links `?next=/minhas-escalas` ou `?next=/escalas-domingo`
  remanescentes do redirecionamento adicionado em `acesso-interno/page.tsx`.

## Impact

- **Banco de dados**: as migrations `0071_sunday_service_scale_panel.sql` e
  `0072_ccm_grants_anon_authenticated.sql` criaram schema/grants para esta feature. Esta
  proposta remove **apenas código de aplicação** — derrubar tabelas/políticas no banco é
  uma decisão separada e mais difícil de reverter (perda de dados), fora de escopo aqui.
  Fica sinalizado para decisão futura, não incluído no checklist.
- Fora de escopo: `changes/refactor-cadastros-page` (tratado separadamente),
  discipulado/convertidos, consolidação dos componentes de login.
- Risco: garantir que nenhuma outra tela ainda referencie as rotas/componentes removidos
  (menu, redirects, imports) — validar com build limpo.
