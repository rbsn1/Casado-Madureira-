# Login split-screen redesign

Status: approved, ready for implementation plan.

## Why

`/login` e `/acesso-interno` usam hoje um card centralizado sobre um fundo
ambiente (`PortalBackground`), com glow azul sutil e um padrão decorativo de
anéis/cruzes quase invisível. Pedido do usuário: deixar essas duas telas com
visual mais profissional e "premium".

Restrição levantada durante o brainstorm: o app é acessado majoritariamente
via smartphone, então qualquer decisão de layout precisa funcionar em tela
pequena, não só em desktop.

## Decisões (aprovadas com o usuário, incluindo comparação visual)

1. **Layout split-screen no desktop** (≥1024px): duas colunas de altura igual
   à viewport — painel de marca à esquerda (~42% da largura), formulário à
   direita (~58%) sobre fundo branco sólido.
2. **No mobile** (<1024px): o painel de marca colapsa para uma faixa
   compacta no topo (~100px de altura), formulário ocupando o resto da tela
   sem exigir rolagem para ver o botão "Entrar" em aparelhos comuns.
3. **Estilo do painel de marca: gradiente abstrato + glow**, não foto nem
   tipografia editorial pura (as outras duas opções mostradas e descartadas).
   Gradiente `brand-900 → #16304e → #0f1e31`, glow radial azul claro no
   topo-esquerda, glow dourado sutil (`accent-500`) no canto inferior-direito.
4. **Escopo: as duas páginas** (`/login` e `/acesso-interno`) recebem o novo
   shell — elas compartilham a mesma experiência de entrada em dois pontos
   diferentes do fluxo (ver "Papéis distintos" abaixo).

## Componentes

### `AuthSplitLayout` (novo — `src/components/layout/AuthSplitLayout.tsx`)

Shell dedicado só para `/login` e `/acesso-interno`. **Não** estende nem
substitui `PortalBackground` — esse continua exatamente como está, usado sem
nenhuma mudança por `/agenda`, `/conta`, `/cadastro/completar`. Motivo de
separar: `PortalBackground` foi desenhado para o padrão "card centralizado
sobre fundo ambiente"; o split-screen é uma composição estrutural diferente
(duas colunas fixas), misturar os dois modos num componente só criaria um
componente fazendo duas coisas.

Props:
```ts
type AuthSplitLayoutProps = {
  children: ReactNode;   // o formulário (LoginForm) ou conteúdo da coluna direita
  label: string;         // "Portal CCM" | "Acesso interno"
  tagline: string;       // frase curta, some na faixa mobile
};
```

Estrutura:
- **Desktop (≥1024px, `lg:` breakpoint do Tailwind)**: `<div className="lg:grid lg:grid-cols-[42%_1fr]">`. Coluna esquerda com o gradiente/glow, logo "CM" em badge translúcido, `label` em uppercase pequeno, `tagline` como frase de destaque. Coluna direita: fundo `bg-bg`, `children` centralizado verticalmente com `max-width` maior que o card atual (`max-w-md` → `max-w-lg`).
- **Mobile (<1024px)**: painel de marca vira uma faixa de altura fixa (~100px) no topo — mesmo gradiente achatado, só logo + `label` (sem `tagline`, não cabe). `children` ocupa o restante da tela abaixo da faixa.
- O padrão decorativo de anéis/cruzes e o glow ambiente do `PortalBackground` **não** são reaproveitados aqui — o gradiente com glow já cumpre o papel de textura/riqueza visual do painel de marca.

### `LoginForm` (existente — sem mudança de lógica)

Reutilizado como está (`src/components/auth/LoginForm.tsx`). Só o entorno
visual muda:
- Título sobe de `text-2xl font-semibold` para `text-3xl font-semibold`.
- Espaçamento entre campos sobe de `space-y-4` para `space-y-6`.
- O `Card`/wrapper com `bg-white/85 backdrop-blur` que envolvia o form some —
  na coluna branca sólida do split-screen não há mais necessidade de um card
  flutuante; o painel de marca ao lado já cumpre o papel de moldura visual.
- Botão de submit ganha `h-12` (em vez do padrão do componente `Button`) e
  `shadow-lg shadow-brand-900/10` no lugar da sombra genérica.

Essas três mudanças de estilo (título, espaçamento, botão) podem ser feitas
via `className` passado pelas páginas que renderizam `LoginForm`, sem alterar
o componente em si — ele já aceita customização de estilo nos elementos
internos através dos componentes do kit (`Button`, `Input`).

## Conteúdo por página

Papéis distintos, preservados (ver contexto: `/acesso-interno` já linka de
volta para `/login` como "o portal"):

| | `/login` | `/acesso-interno` |
|---|---|---|
| `label` | "Portal CCM" | "Acesso interno" |
| `tagline` | "Gestão de integração, batismo e voluntariado da comunidade." | "Acompanhe cadastros, relatórios e times em um só lugar." |
| `showRememberMe` (já existe no `LoginForm`) | `false` | `true` |
| Extra na coluna direita | Links "Ver agenda · Cadastro" abaixo do form (como hoje, mas dentro da coluna branca, não mais sobre fundo ambiente) | Link "Voltar ao portal →" — desce do header (que deixa de existir nesse formato) para um link discreto abaixo do botão "Entrar" |

## Impact

- `src/app/(public)/login/page.tsx` e `src/app/(public)/acesso-interno/page.tsx`
  trocam `PortalBackground` por `AuthSplitLayout`. Nenhuma mudança de
  comportamento (`LoginForm` continua idêntico).
- Nenhuma outra página é afetada — `PortalBackground` continua servindo
  `/agenda`, `/conta`, `/cadastro/completar` exatamente como hoje.
- Fora de escopo: mudar `PortalBackground` em si, mudar a navegação entre as
  duas rotas, adicionar dark mode (decisão de fase anterior: só tema claro).
- Verificação: screenshot em pelo menos 2 larguras (mobile ~375px, desktop
  ~1440px) das duas páginas antes de considerar concluído, já que a restrição
  que motivou o redesign foi justamente uso predominante em smartphone.
