# Corrigir 403 de ADMIN_MASTER em gestão de usuários/papéis

## Why

`requireDiscipuladoAdmin()` (`src/lib/serverAuth.ts:83-134`) protege
`/api/admin/users` (GET/POST/DELETE) e `/api/admin/roles` (POST) exigindo a role
`ADMIN_DISCIPULADO` — sem nenhum bypass para `ADMIN_MASTER`/`SUPER_ADMIN`, ao
contrário de `requireAdmin()` (linhas 53-81), que aceita os dois.

`admin/page.tsx`, a única tela que chama essas duas rotas, já é gateada a
`ADMIN_MASTER` no `AppShell`. Ou seja: **hoje um `ADMIN_MASTER` real recebe 403
em qualquer operação de usuário/papel**, a menos que também tenha
`ADMIN_DISCIPULADO` ativo no banco — o que não faz mais sentido, já que o módulo
Discipulado foi removido do app.

Achado pela auditoria `streamline-app` (2026-08-09); já era um problema antes da
remoção do Discipulado (decisão do usuário na época foi deixar como estava), mas
agora que o módulo não existe mais, o gate baseado em `ADMIN_DISCIPULADO` não tem
mais razão de ser a via principal de acesso.

Achado relacionado, mesma tela: `roleOptions` (linha 33-46) ainda lista as 4
roles do Discipulado (`ADMIN_DISCIPULADO`, `DISCIPULADOR`, `SM_DISCIPULADO`,
`SECRETARIA_DISCIPULADO`) no dropdown de atribuição de papel. Além de não fazerem
mais sentido, atribuir uma dessas roles **desativa todos os outros papéis ativos
do usuário** (`api/admin/roles/route.ts:158-169`) — um admin pode
inadvertidamente tirar o acesso de alguém ao CCM inteiro escolhendo uma dessas
opções órfãs.

## What Changes

- `src/lib/serverAuth.ts`: `requireDiscipuladoAdmin` passa a aceitar também
  `ADMIN_MASTER`/`SUPER_ADMIN` (mesma tabela `usuarios_perfis`, mesmo padrão de
  `requireAdmin`), tratando esses casos como admin global
  (`isGlobalAdmin: true, congregationId: null`) — o mesmo formato de retorno já
  usado hoje para `ADMIN_DISCIPULADO` sem congregação. Nenhuma mudança necessária
  nas rotas que consomem essa função: toda a lógica de escopo por congregação já
  é pulada quando `isGlobalAdmin` é `true`.
- Renomear `requireDiscipuladoAdmin` → `requireUserManagementAdmin` nos 3 arquivos
  que a referenciam (`serverAuth.ts`, `api/admin/users/route.ts`,
  `api/admin/roles/route.ts`), já que a função deixou de ser específica do
  Discipulado — é o gate de toda a gestão de usuários/papéis do app. O nome atual
  confunde o próximo desenvolvedor a pensar que só discipulado usa essa rota.
- `src/app/(app)/admin/page.tsx`: remover as 4 roles do Discipulado de
  `roleOptions`.

## Impact

- `ADMIN_MASTER`/`SUPER_ADMIN` reais passam a conseguir listar, criar, editar e
  excluir usuários/papéis normalmente em `/admin` — comportamento que hoje está
  quebrado.
- O dropdown de atribuição de papel em `/admin` perde as 4 opções de Discipulado;
  nenhum usuário existente é afetado (a migration `0075` já desativa quem tinha
  essas roles, mas não precisa estar aplicada para esta mudança de UI).
- Fora de escopo: simplificar/remover de vez a lógica de
  `DISCIPULADO_ONLY_ROLES` e o escopo por congregação dentro de
  `api/admin/users/route.ts` e `api/admin/roles/route.ts` — hoje ela só entra em
  jogo quando `isGlobalAdmin` é `false`, o que não vai mais acontecer na prática
  depois desta mudança (não há mais interface para criar um admin
  congregação-específico de discipulado), mas removê-la de fato é uma
  simplificação maior e mais arriscada, fica para uma mudança futura dedicada.
- Fora de escopo: aplicar a migration `0075_remove_discipulado_module.sql` no
  banco (ação separada e deliberada, como já decidido antes).
