# Remover código morto e consolidar slugify duplicado

## Why

Uma varredura cruzada (grep de cada componente/lib contra todo `src`, checando
imports por nome de arquivo, inclusive imports "de diretório" via `index.ts`)
encontrou 5 arquivos que não são referenciados em lugar nenhum do projeto — 1076
linhas de código morto — e uma função `slugify` duplicada inline em dois lugares
apesar de já existir uma versão compartilhada não usada.

Remover isso agora, antes de seguir com refactors maiores no resto do app, evita
que alguém gaste tempo lendo/mantendo código que nunca roda.

## What Changes

- Excluir `src/components/LoginPage.tsx` (215 linhas) — não importado por nenhuma
  rota; `(public)/login/page.tsx` tem seu próprio componente `LoginPage` inline,
  sem relação com este arquivo.
- Excluir `src/components/LoginDiscipuladoPremium.tsx` (317 linhas) — não importado.
- Excluir `src/components/LoginPortalDiscipulado.tsx` (252 linhas) — não importado.
- Excluir `src/components/StarfieldCanvas.tsx` (211 linhas) — não importado.
- Excluir `src/lib/demoData.ts` (81 linhas) — não importado.
- Consolidar a função `slugify` duplicada em
  `src/app/api/admin/congregations/route.ts` e
  `src/app/api/admin/congregations/[id]/route.ts`: remover as duas implementações
  inline e importar de `src/lib/slugify.ts` (mesma lógica, mantém as duas
  variações de normalização unificadas na versão do lib).

## Impact

- Nenhuma rota, componente ou API é afetada — os arquivos removidos não têm
  nenhum importador. Nenhuma mudança de comportamento visível.
- As duas rotas de congregations passam a depender de `lib/slugify.ts`; a
  implementação do lib usa `\p{Diacritic}` (regex unicode) em vez de
  `[̀-ͯ]` — funcionalmente equivalente para remoção de acentos, mas
  vale conferir com um slug real (ex.: "Congregação São José") após a mudança.
- Fora de escopo: os módulos monolíticos de discipulado/admin, admin geral etc.
  (tratados em mudanças futuras separadas), vulnerabilidades de dependências.
