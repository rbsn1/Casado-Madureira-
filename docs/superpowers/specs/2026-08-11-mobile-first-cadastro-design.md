# Mobile-first no fluxo de cadastro — Design

## Why

O app já tem uma base mobile decente (menu inferior + off-canvas no `AppShell`, CSS que evita zoom automático do iOS em inputs, lista de `/cadastros` com cartões no celular e tabela no desktop). Mas quem de fato usa o app no celular no dia a dia é a equipe de cadastro (durante o culto e ao registrar quem entra pelo grupo do WhatsApp) e a pessoa comum que recebe o link de complementação de cadastro no próprio telefone. Admin, relatórios e gestão de usuários continuam sendo usados por alguém sentado num computador.

Um audit dessas telas específicas encontrou 4 lacunas concretas:

1. **Sem PWA instalável** — não há `manifest.json`, ícone de tela inicial nem `theme-color`. Quem usa isso o culto inteiro no celular precisa abrir o navegador e digitar a URL toda vez.
2. **`/cadastro/completar`** (o link que a pessoa comum recebe no próprio celular pra terminar o cadastro) tem os alvos de toque mais apertados do app (`py-2`, ~36px, contra `py-3`/44px+ usado no resto) — na única tela garantidamente usada por alguém de fora da equipe, sem instrução nenhuma. Também faltam `inputMode`/`autoComplete` em CPF e e-mail.
3. **Barra de ações em `/cadastros`** empilha 5 botões no mobile antes da lista de pessoas (Novo cadastro, Adicionar do grupo, Exportar, Importar, Baixar modelo) — as ações raras empurram a lista pra baixo da dobra.
4. **Modal compartilhado** (`src/components/ui/modal.tsx`) não tem limite de altura/scroll — baixo risco hoje (só é usado pela troca de senha), mas não é seguro por padrão para conteúdo maior em telas curtas ou com teclado aberto.

## What Changes

### PWA instalável
- Novo `public/manifest.json`: nome, `short_name`, `start_url: "/acesso-interno"`, `display: "standalone"`, `theme_color`/`background_color` alinhados à paleta `brand` já existente, ícones 192px e 512px.
- Novos ícones em `public/icons/` gerados a partir do "CM" que já aparece como logótipo no `AppShell` (mesmo estilo, fundo `brand-600`).
- `src/app/layout.tsx`: adicionar `manifest: "/manifest.json"` e `themeColor` ao `export const metadata`/`viewport` do Next.js (App Router usa os campos nativos de metadata, não precisa de `<meta>` manual), mais `apple-touch-icon` via `icons` no metadata.

### `/cadastro/completar` (formulário público de complementação)
- Trocar `px-3 py-2` → `px-4 py-3` em todos os campos e no botão de envio, igualando ao padrão já usado em `/cadastro` e `CadastroForm`.
- Adicionar `inputMode="numeric"` no campo CPF (o `formatCpfInput` já existe e cuida da máscara).
- Adicionar `autoComplete="email"` no campo de e-mail e `autoComplete="postal-code"`/`autoComplete="street-address"` nos campos de endereço, quando fizer sentido para o teclado do navegador.

### Barra de ações em `/cadastros`
- No mobile (abaixo de `sm`), manter visíveis apenas "Novo cadastro" e "Adicionar do grupo" (as duas ações de registro). "Exportar CSV", "Importar CSV/XLSX" e "Baixar modelo" saem para um menu secundário colapsável ("Mais ações"), aberto por um botão/ícone de "mais opções".
- No desktop (`sm` e acima), a barra continua exatamente como está hoje — os 5 botões lado a lado, sem menu colapsado, já que lá não há problema de espaço.

### `/cadastro` (formulário rápido do CADASTRADOR)
- Revisão de polimento apenas: conferir que os alvos de toque, `inputMode`, `autoComplete` já usados aqui servem de referência para os itens acima. Não é esperada mudança estrutural — esta tela já segue o padrão que as outras vão adotar.

### Hardening do modal compartilhado
- `src/components/ui/modal.tsx`: adicionar `max-h-[85vh] overflow-y-auto` ao painel do modal, para que conteúdo mais alto que a viewport (teclado aberto, tela curta) role dentro do modal em vez de ser cortado. Efeito colateral positivo automático no modal de "Alterar senha" (`AppShell`) e em qualquer modal futuro que use este componente.

## Impact

- **O que muda de verdade:** aparência/comportamento responsivo de 3 telas (`/cadastro/completar`, `/cadastros`, e o modal compartilhado) e a adição de suporte a instalação como PWA. Nenhuma lógica de negócio, chamada a Supabase, ou schema muda.
- **O que fica explicitamente de fora:** admin, relatórios, gestão de usuários, WhatsApp admin, agenda semanal, manual — essas telas não são redesenhadas nesta rodada; só receberiam correção pontual se um bug bloqueante de mobile fosse encontrado nelas durante a implementação, e isso seria levantado ao usuário antes de qualquer mudança fora do escopo aqui descrito.
- **`AdicionarDoGrupoModal`** (adicionado na feature de onboarding do WhatsApp) já segue o padrão de toque adequado (`py-3`) e é curto o bastante para não precisar do hardening de scroll do modal compartilhado — fica como está.
- **Sem migração de banco, sem mudança de API.** É seguro de reverter a qualquer momento (são só classes CSS, marcação e um manifest novo).

## Testing

Não há suíte de testes automatizada neste projeto. Verificação:
- `npm run build` e `npm run lint` (Node 20, mesmo padrão usado nas sessões anteriores).
- Teste manual redimensionando para larguras de celular comuns (375px, 390px, 414px) nas 3 telas alteradas.
- Verificação do manifest via DevTools → Application → Manifest (ícones carregando, `display: standalone` reconhecido) e teste de instalação real no celular do usuário, se disponível.
