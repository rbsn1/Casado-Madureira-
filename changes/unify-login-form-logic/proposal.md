# Unificar a lógica de login em um componente compartilhado

## Why

`/login` (`src/app/(public)/login/page.tsx`) e `/acesso-interno`
(`src/app/(public)/acesso-interno/page.tsx`) não são a mesma tela por acidente —
`/acesso-interno` trata `/login` como "o portal" (link "Voltar ao portal →" aponta
pra lá) e se posiciona como o portão de acesso interno em si. Papéis diferentes,
navegação intencional.

O problema não é a existência das duas rotas, é que `handleSubmit` e
`handlePasswordReset` foram implementados duas vezes, quase idênticos, e já
divergiram:

- `/login` chama `supabaseClient.rpc("get_my_roles")` direto (RPC legada) pra
  decidir o redirect pós-login.
- `/acesso-interno` chama `getAuthScope()` (`src/lib/authScope.ts`), que tenta
  `get_my_context` primeiro e cai pra `get_my_roles` só como fallback — a
  abstração atual, mais robusta.
- Só `/acesso-interno` lê `?next=` da URL pra voltar o usuário pra página
  correta após o login.

Achado pela auditoria `streamline-app` (2026-08-09). Toda mudança futura em como
o login funciona (novo campo, nova regra de redirect, nova mensagem de erro)
precisaria ser replicada nos dois lugares manualmente — é assim que elas vão
seguir divergindo.

## What Changes

- Criar `src/components/auth/LoginForm.tsx` (client component) com os campos
  E-mail/Senha, botão de submit, "Esqueci minha senha", mensagens de
  erro/sucesso, e a lógica de `handleSubmit`/`handlePasswordReset` — usando
  `getAuthScope()` (não a RPC legada) e suporte a `?next=`, e os componentes
  `Input`/`Button`/`Checkbox` do kit (`src/components/ui/`).
  - Prop `showRememberMe?: boolean` (default `false`) controla se o checkbox
    "Manter conectado" aparece — hoje só `/acesso-interno` tem esse campo.
- `src/app/(public)/acesso-interno/page.tsx`: mantém seu header/Card/copy
  próprios, passa a renderizar `<LoginForm showRememberMe />` em vez de ter o
  formulário inline.
- `src/app/(public)/login/page.tsx`: mantém seu header/card/copy e o rodapé
  "Ver agenda · Cadastro" próprios, passa a renderizar `<LoginForm />` em vez de
  ter o formulário inline.

## Impact

- Mudança de comportamento intencional em `/login`: passa a usar
  `getAuthScope()` em vez da RPC legada `get_my_roles` (mesma decisão de
  redirect na prática — CADASTRADOR-only vai pra `/cadastro`, resto vai pra `/`
  — só que através do helper com fallback, mais robusto), e passa a suportar
  `?next=` como `/acesso-interno` já suporta.
- Nenhuma mudança visual nas duas páginas — header, copy, links de rodapé e
  card continuam exatamente como estão hoje, só o formulário interno passa a
  vir de um componente compartilhado.
- Fora de escopo: mudar a navegação entre as duas rotas (qual é "o portal", pra
  onde cada uma redireciona) — isso é decisão de produto, não limpeza de
  código, e não foi pedido.
