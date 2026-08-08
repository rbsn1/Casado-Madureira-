# Remover o módulo de Discipulado deste repositório e banco

## Why

O discipulado agora é servido por um app/banco Supabase independente e já está em
produção lá (confirmado pelo usuário). O que resta neste repositório CCM é uma
cópia legada: ~7.500 linhas de UI, 12 tabelas próprias e 46 das 74 migrations
deste projeto.

Uma pesquisa dedicada (ver `changes/remove-discipulado-module/research-notes.md`)
mapeou que o discipulado **não está isolado no banco** — há um trigger em uma
tabela do CCM (`pessoa_departamento`) que depende de uma tabela de discipulado, e
duas policies de `pessoas` que referenciam tabelas de discipulado. Remover as
tabelas sem tratar esses pontos quebraria funcionalidade do CCM (vínculo
membro-departamento, leitura de `pessoas`).

Decisões já tomadas com o usuário para esta mudança:
- **Gestão de departamentos** (hoje delegada 100% ao discipulado) fica **sem
  tela própria por enquanto** — não será reconstruída nesta mudança.
- **`/admin` (gestão de usuários/papéis do CCM)** hoje já depende de
  `requireDiscipuladoAdmin()` (role `ADMIN_DISCIPULADO`), o que parece já estar
  quebrado para `ADMIN_MASTER` reais. Fica **como está**, sem conserto nesta
  mudança — `src/lib/serverAuth.ts`, `api/admin/users`, `api/admin/roles` não
  são tocados.
- **Dados históricos** que "nasceram" do discipulado mas hoje vivem em tabelas
  do CCM (`pessoas.cadastro_origem = 'discipulado'`, linhas de
  `eventos_timeline` com origem discipulado) **ficam como estão** — não há
  expurgo de dados nesta mudança.

## What Changes

### Código (deletar arquivos inteiros)
- `src/app/(app)/discipulado/**` (admin, confraternizacao, convertidos/[id],
  convertidos/novo, convertidos, departamentos, discipulado, fila,
  integracao-pos-discipulado, layout, manual, page)
- `src/app/(public)/discipulado/login/page.tsx` + `loginBackground.module.css`
- `src/app/api/discipulado/assignees/route.ts`
- `src/app/api/admin/discipulado/calendar/route.ts`
- `src/app/api/admin/congregations/route.ts` e `[id]/route.ts` (confirmado: só
  chamados por `discipulado/admin/page.tsx`; a tabela `congregations` em si
  **não é tocada**, é infraestrutura multi-congregação do CCM)
- `src/components/discipulado/**` (chamada/*, dashboard/*)
- `src/lib/discipleshipCases.ts`, `discipuladoPanels.ts`,
  `discipleshipCriticality.ts`, `chamada.ts`, `confraternizacao.ts`,
  `evangelisticImpact.ts`
- `src/hooks/useActiveConfraternizacao.ts`
- Assets em `public/`: `discipulado-mark.png`, `discipulado-crop.png`,
  `discipulado-wordmark.png`, `discipulado-login-bg-2160x2700.webp`,
  `discipulado-login-stars.png`, `logo-discipulado-symbol-512.png`,
  `logo-discipulado-symbol-512 (1).png`

### Código (editar cirurgicamente, arquivo continua existindo)
- `src/components/layout/AppShell.tsx` — remover seção de nav "Discipulado",
  branding/tema condicional, redirecionamento de contas discipulado
- `src/lib/authScope.ts` — remover `DISCIPULADO_ACCOUNT_ROLES`,
  `DISCIPULADO_ADMIN_ROLES`, `hasDiscipuladoAccessRole`,
  `hasDiscipuladoAdminRole`, `isDiscipuladoScopedAccount`,
  `getDiscipuladoHomePath` (o resto do arquivo, `getAuthScope()`, fica)
- `src/app/(public)/acesso-interno/page.tsx` — remover branch de redirect para
  `/discipulado/login`
- `src/app/(app)/page.tsx` — remover bloco condicional de cards de discipulado
  no dashboard
- `src/hooks/useDashboardData.ts` + `src/types/dashboard.ts` — remover
  `discipleshipCards` e a chamada à RPC `get_discipleship_dashboard`
- `src/app/(app)/novos-convertidos/page.tsx`,
  `src/app/(app)/pessoas/[id]/page.tsx` — remover link para
  `/discipulado/convertidos`
- `src/app/(app)/manual/guia-pratico/page.tsx`,
  `src/app/(app)/manual/jornada-completa/page.tsx` — remover seções sobre
  discipulado
- `src/components/layout/PortalBackground.tsx` — remover variante
  `theme === "discipulado"` (só era usada pelo login de discipulado)
- `src/app/globals.css` — remover blocos `.discipulado-theme` e
  `.discipulado-panel`
- `src/app/(app)/admin/departamentos/[id]/page.tsx`,
  `.../admin/departamentos/novo/page.tsx`, `.../admin/departamentos/page.tsx`,
  `src/app/(app)/departamentos/page.tsx` — hoje fazem
  `redirect("/discipulado/departamentos")`, que passaria a ser um 404 morto.
  Trocar o alvo do redirect para `/` (não é reconstrução de gestão de
  departamentos, só evita um link quebrado causado por esta remoção).

### Banco de dados (migration nova, criada mas **não aplicada**)
1. `DROP TRIGGER trg_enforce_department_eligibility ON pessoa_departamento`,
   `DROP FUNCTION enforce_department_eligibility()`,
   `DROP FUNCTION is_member_department_eligible(uuid)` — remove a dependência
   que travaria vínculo membro-departamento no CCM após o DROP das tabelas.
2. `DROP TRIGGER trg_enforce_discipleship_role_isolation ON usuarios_perfis`,
   `DROP FUNCTION enforce_discipleship_role_isolation()`.
3. `DROP POLICY pessoas_read_discipulado_bridge ON pessoas`,
   `DROP POLICY pessoas_delete_discipulado_bridge ON pessoas` — essas
   referenciam tabelas de discipulado; deixadas como estão, quebrariam leitura
   de `pessoas` inteira quando as tabelas fossem derrubadas.
4. `DROP TABLE IF EXISTS ... CASCADE` nas 12 tabelas exclusivas de discipulado:
   `ccm_discipleship_cases`, `discipleship_modules`, `discipleship_progress`,
   `discipleship_calendar`, `ccm_contact_attempts`, `confraternizacoes`,
   `discipleship_turma_settings`, `discipleship_turmas`,
   `discipleship_turma_alunos`, `discipleship_aulas`,
   `discipleship_chamada_itens`, `discipleship_case_events`.
5. `DROP FUNCTION` das ~29 funções/RPCs exclusivas de discipulado (lista
   completa em `research-notes.md`).
6. Em `usuarios_perfis`, marcar `active = false` para qualquer linha com role
   `DISCIPULADOR`, `SM_DISCIPULADO`, `ADMIN_DISCIPULADO` ou
   `SECRETARIA_DISCIPULADO` (mesmo padrão de desativação suave já usado na
   migration `0070`) — preserva o histórico da tabela sem apagar linhas.

### O que fica intocado, de propósito
- `pessoas.cadastro_origem`, `pessoas.culto_origem`, `pessoas.request_id` e as
  funções/triggers associadas — hoje são usadas por RPCs 100% CCM
  (`0055`, `0066`–`0069`).
- Policies em `departamentos`, `pessoa_departamento`, `departamentos_publicos`,
  `departments`, `department_roles`, `department_contacts`, `department_faq`,
  `integracao_novos_convertidos`, `batismos`, `eventos_timeline`,
  `pessoas_read` — ainda citam roles de discipulado, mas viram cláusulas
  inertes (ninguém mais terá esses roles) sem referenciar tabelas derrubadas,
  então não quebram nada. Limpá-las é cosmético, não funcional — fica para uma
  mudança futura se quiserem.
- `src/lib/serverAuth.ts`, `src/app/api/admin/users/route.ts`,
  `src/app/api/admin/roles/route.ts` — decisão do usuário de não mexer agora.
- Valor `'CHAMADA'` no enum `timeline_tipo` — Postgres não permite remover
  valor de enum facilmente; linhas históricas com esse tipo continuam existindo.
- `public.congregations` — apesar de criada na migration `0015` (nome tem
  "discipulado"), é infraestrutura multi-congregação usada por todo o CCM.
  **Não é tocada.**

## Impact

- Este repositório perde toda a UI/rotas/API de discipulado. Qualquer link
  externo para `/discipulado/*` passa a 404 (exceto os 4 redirects de
  departamentos, ajustados para `/`).
- Gestão de departamentos do CCM fica sem tela própria (decisão do usuário,
  já era assim antes desta mudança).
- `/admin` do CCM continua com gestão de usuários/papéis não funcional para
  `ADMIN_MASTER` (decisão do usuário, já era assim antes desta mudança).
- A migration de banco é criada mas **não aplicada** — like o padrão já usado
  em `remove-escalas-domingo`, aplicar no Supabase é uma ação separada e
  deliberada do usuário.
- Fora de escopo: qualquer mudança de produto no app independente de
  discipulado (fora deste repositório).
