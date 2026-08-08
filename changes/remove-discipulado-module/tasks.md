# Tasks — Remover módulo de Discipulado

## Código — deletar arquivos/diretórios inteiros
- [x] `src/app/(app)/discipulado/` (diretório inteiro)
- [x] `src/app/(public)/discipulado/` (diretório inteiro, inclui login e css module)
- [x] `src/app/api/discipulado/` (diretório inteiro)
- [x] `src/app/api/admin/discipulado/` (diretório inteiro)
- [x] `src/app/api/admin/congregations/` (diretório inteiro — route.ts e [id]/route.ts)
- [x] `src/components/discipulado/` (diretório inteiro)
- [x] `src/lib/discipleshipCases.ts`, `discipuladoPanels.ts`,
      `discipleshipCriticality.ts`, `chamada.ts`, `confraternizacao.ts`,
      `evangelisticImpact.ts`
- [x] `src/hooks/useActiveConfraternizacao.ts`
- [x] Assets em `public/`: `discipulado-mark.png`, `discipulado-crop.png`,
      `discipulado-wordmark.png`, `discipulado-login-bg-2160x2700.webp`,
      `discipulado-login-stars.png`, `logo-discipulado-symbol-512.png`,
      `logo-discipulado-symbol-512 (1).png`
- [x] Extra encontrado na verificação: `src/components/LoginDiscipuladoPremium.tsx`
      e `src/components/LoginPortalDiscipulado.tsx` — código morto (nunca
      importados) e 100% discipulado; não estavam no research original porque
      vieram de uma investigação de dead-code anterior, não do mapeamento de
      entanglement. Removidos junto.

## Código — editar cirurgicamente
- [x] `src/components/layout/AppShell.tsx` — nav/tema/redirect de discipulado
      removidos (reescrito, arquivo tinha ramificação `isDiscipuladoConsole`
      espalhada por quase todo o componente)
- [x] `src/lib/authScope.ts` — removidos `DISCIPULADO_ACCOUNT_ROLES`,
      `DISCIPULADO_ADMIN_ROLES`, `hasDiscipuladoAccessRole`,
      `hasDiscipuladoAdminRole`, `isDiscipuladoScopedAccount`,
      `getDiscipuladoHomePath`
- [x] `src/app/(public)/acesso-interno/page.tsx` — branch de redirect removido
- [x] Extra encontrado na verificação: `src/app/(public)/conta/page.tsx`
      também usava `isDiscipuladoScopedAccount`/`getDiscipuladoHomePath` e não
      estava listado no proposal original — corrigido junto
- [x] `src/app/(app)/page.tsx` — cards de discipulado do dashboard removidos
- [x] `src/hooks/useDashboardData.ts` + `src/types/dashboard.ts` —
      `discipleshipCards`, `userRoles` e a chamada a `get_discipleship_dashboard`
      removidos
- [x] `src/app/(app)/novos-convertidos/page.tsx` — link removido
- [x] `src/app/(app)/pessoas/[id]/page.tsx` — link e aviso de texto sobre o
      módulo removidos
- [x] `src/app/(app)/manual/guia-pratico/page.tsx` — seções de discipulado
      removidas
- [x] `src/app/(app)/manual/jornada-completa/page.tsx` — reescrito sem
      discipulado (mapa mental, fluxo e matriz de perfis)
- [x] `src/components/layout/PortalBackground.tsx` — verificado: não tinha
      variante de tema (divergência da pesquisa, nada a fazer)
- [x] `src/app/globals.css` — verificado: não tinha blocos `.discipulado-*`
      (divergência da pesquisa, nada a fazer)
- [x] Redirects de departamentos — já estavam apontando para `/` (feito antes
      desta sessão de apply, confirmado via `git diff`)

## Banco de dados — migration nova (criada, NÃO aplicada)
- [x] `supabase/migrations/0075_remove_discipulado_module.sql` criada com:
  trigger+functions de elegibilidade de departamento, trigger+function de
  isolamento de role, policies `pessoas_read_discipulado_bridge`/
  `pessoas_delete_discipulado_bridge`, desativação soft de `usuarios_perfis`
  com role de discipulado, ~29 funções/RPCs exclusivas, e as 12 tabelas
  exclusivas de discipulado (com CASCADE)

## Verificação
- [x] Grep final por discipulado/discipleship/roles — só restam
      `api/admin/users`, `api/admin/roles`, `serverAuth.ts` e `admin/page.tsx`
      (decisão explícita do usuário de não tocar) e uma entrada inofensiva
      `EM_DISCIPULADO` no mapa de estilos de `StatusBadge.tsx` (chave morta,
      sem efeito, não vale o risco de mexer num componente compartilhado)
- [x] `npm run build` — compilou limpo, nenhuma rota `/discipulado/*` na saída
- [x] `npm run lint` — sem warnings/erros
- [x] Redirects de departamentos confirmados apontando para `/`
