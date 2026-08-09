# Remover páginas-fantasma e assets sem uso

## Why

A auditoria `streamline-app` (2026-08-09) encontrou dois tipos de peso morto
que `remove-dead-code` não cobre (esse tratou só de arquivos-fonte órfãos):

1. **4 rotas que só fazem `redirect("/")`** — resquício da remoção do módulo
   de discipulado, que era quem gerenciava departamentos. Confirmado por
   grep: nenhum `<Link>` no código aponta para `/departamentos` ou
   `/admin/departamentos*`.
2. **Assets em `public/` sem nenhuma referência em `src`** — imagens e uma
   planilha que não aparecem em nenhum `href`/`src`/import.

Nota: `public/cadastros.csv` e os dois `confirmados_confraternizacao_*.csv`
também não têm referência no código, mas contêm dados reais de membros
(nome, telefone) — por decisão do usuário, ficam de fora desta limpeza.

## What Changes

- Excluir as 4 páginas-redirect:
  - `src/app/(app)/admin/departamentos/page.tsx`
  - `src/app/(app)/admin/departamentos/novo/page.tsx`
  - `src/app/(app)/admin/departamentos/[id]/page.tsx`
  - `src/app/(app)/departamentos/page.tsx`
- Excluir os assets sem referência e sem dado pessoal:
  - `public/visual.png`
  - `public/taladelogindis.png`
  - `public/novo.png`
  - `public/portal-hero.jpg`
  - `public/bg/starfield.png` (ligado ao `StarfieldCanvas.tsx`, já removido)
  - `public/ChatGPT Image Feb 16, 2026, 12_42_11 PM.png`
  - `public/ChatGPT Image Feb 16, 2026, 12_48_00 PM.png`
  - `public/ChatGPT Image Feb 20, 2026, 08_26_11 PM.png`
  - `public/ChatGPT Image Feb 21, 2026, 12_12_22 PM.png`
  - `public/ChatGPT Image Feb 21, 2026, 12_15_23 PM.png`
  - `public/cadastros_import_modelo.xlsx` (o `.csv` equivalente continua,
    é o único referenciado em `cadastros/page.tsx:261`)

## Impact

- As 4 rotas de departamentos deixam de existir (hoje só faziam redirect
  para `/`, então visitar essas URLs diretamente passa a dar 404 em vez de
  redirecionar — mudança mínima, ninguém navega até lá pelo app).
- Assets removidos não são carregados por nenhuma tela hoje; sem mudança
  visual.
- `public/cadastros.csv` e `confirmados_confraternizacao_*.csv`
  **permanecem**, por decisão explícita do usuário.
- Fora de escopo: bug de `hero-community.jpg` ausente (tratado em proposta
  separada de UX), `xlsx` do import de planilhas (é `src/lib`, não
  `public/`, tratado separadamente).
