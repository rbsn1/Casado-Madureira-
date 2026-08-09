# Remover código morto

## Why

A varredura original (cross-referência de cada componente/lib contra todo `src`,
por nome de arquivo e por símbolo exportado) encontrou 5 arquivos sem nenhum
importador. Desde então, 2 desses 5 já foram removidos como efeito colateral da
remoção do módulo Discipulado. Uma nova varredura (parte da auditoria
`streamline-app`, 2026-08-09) confirmou os 3 restantes e encontrou 2 arquivos
mortos novos que a varredura original não pegou.

Lista final, todos com zero importadores confirmados (grep por especificador de
import e por símbolo exportado; não há nenhum `index.ts`/barrel no projeto, então
não há indireção a considerar):

- `src/components/LoginPage.tsx` (215 linhas) — não relacionado ao componente
  `LoginPage` local de `(public)/login/page.tsx` (mesmo nome, arquivo diferente).
- `src/components/StarfieldCanvas.tsx` (211 linhas).
- `src/lib/demoData.ts` (81 linhas).
- `src/lib/slugify.ts` (9 linhas) — seus dois únicos chamadores eram as rotas
  `api/admin/congregations/*`, removidas junto com o Discipulado.
- `src/components/shared/HelpChatWidget.tsx` (624 linhas) — o maior achado desta
  rodada; exporta `HelpChatWidget`, também sem nenhuma referência em `src`.
- `src/lib/lucide-react.tsx` (79 linhas) — shim que reimplementa 5 ícones no
  formato da API do pacote `lucide-react`, que **não está instalado**
  (`package.json` não lista `lucide-react` como dependência).

Total: ~1.219 linhas removidas, nenhuma mudança de comportamento visível.

## What Changes

- Excluir os 6 arquivos listados acima.
- Nenhum outro arquivo referencia nenhum deles — não há import a atualizar em
  nenhuma outra parte do código.

## Impact

- Nenhuma rota, componente ou API é afetada. Nenhuma mudança de comportamento
  visível para o usuário final.
- Fora de escopo (tratados em propostas separadas, também saídas da auditoria
  `streamline-app`):
  - O bug de `requireDiscipuladoAdmin()` sem bypass para `ADMIN_MASTER`/
    `SUPER_ADMIN` (403 real em `/api/admin/users` e `/api/admin/roles`).
  - As 4 roles órfãs do Discipulado ainda listadas no dropdown de
    `admin/page.tsx`.
  - Unificação das telas `/login` e `/acesso-interno`.
  - Lógica duplicada (`toTwoDigits`, parsing de data, normalização de telefone)
    entre `cadastrosImport.ts` e `enqueue/route.ts`.
  - Arquivos monolíticos (`admin/page.tsx`, `admin/whatsapp/page.tsx`).
  - Vulnerabilidades de dependências (`next`, `xlsx`, `ws`) — usuário decidiu não
    tratar agora.
