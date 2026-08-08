# Notas de pesquisa — entanglement discipulado x CCM

Levantamento feito por um agente de pesquisa dedicado, lendo as 50 migrations
que tocam discipulado (`0015`–`0073`) e os arquivos de código relacionados.
Serve de referência para `proposal.md` e `tasks.md` — não é um documento vivo,
é o registro do que foi encontrado antes de escrever a migration/os patches.

## Riscos críticos identificados

1. **Trigger `trg_enforce_department_eligibility` em `pessoa_departamento`**
   (tabela do CCM) chama `enforce_department_eligibility()` →
   `is_member_department_eligible(uuid)`, que lê `ccm_discipleship_cases`.
   Sem remover trigger+functions antes do `DROP TABLE`, todo
   INSERT/UPDATE em `pessoa_departamento` quebra.

2. **Gestão de departamentos do CCM já foi 100% delegada ao discipulado**
   desde a migration `0024_departamentos_gestao_no_discipulado.sql`: as
   policies de escrita em `departamentos`, `pessoa_departamento`,
   `departamentos_publicos`, `departments`, `department_roles`,
   `department_contacts`, `department_faq` exigem `SUPER_ADMIN`/`DISCIPULADOR`
   (via `is_admin_master() OR has_role(...)`), e as páginas
   `admin/departamentos/*` do CCM só fazem
   `redirect("/discipulado/departamentos")`. Decisão do usuário: deixar sem
   gestão própria por enquanto.

3. **`api/admin/users` e `api/admin/roles`** (usados por `admin/page.tsx` do
   CCM) são protegidos por `requireDiscipuladoAdmin()` em `serverAuth.ts`, que
   exige role `ADMIN_DISCIPULADO` — não `ADMIN_MASTER`. Como um trigger já
   impede um usuário de ter `ADMIN_MASTER` e `ADMIN_DISCIPULADO` ativos ao
   mesmo tempo, isso sugere que a gestão de usuários do CCM já está
   inacessível para admins reais, independente desta mudança. Decisão do
   usuário: deixar como está.

## Tabelas 100% discipulado (safe to DROP TABLE)

`ccm_discipleship_cases` (0015), `discipleship_modules` (0015),
`discipleship_progress` (0015), `discipleship_calendar` (0025),
`ccm_contact_attempts` (0025), `confraternizacoes` (0046),
`discipleship_turma_settings` (0050), `discipleship_turmas` (0057),
`discipleship_turma_alunos` (0057), `discipleship_aulas` (0057),
`discipleship_chamada_itens` (0057), `discipleship_case_events` (0059).

`public.congregations` (também criada na 0015) **não é discipulado-exclusiva**
— é infraestrutura multi-congregação usada por `pessoas`, `usuarios_perfis`,
`departamentos`, `batismos` etc. Não tocar.

## Colunas do CCM que nasceram em migrations de discipulado mas hoje são do CCM

- `pessoas.cadastro_origem` (0044) — usada por `get_casados_dashboard`,
  `get_novos_dashboard`, e por `0055_ccm_historico_mensal.sql`,
  `0066_whatsapp_normalizar_e164_no_cadastro.sql`.
- `pessoas.culto_origem` (0054) — usada por `0067_ccm_culto_rapido.sql`,
  `0068_ccm_quick_registration_rpc.sql`, `0069_ccm_full_registration_rpc.sql`.
- `pessoas.request_id` (0015) — usado por `ccm_discipleship_cases.request_id`
  (índice único) e pelos fluxos de cadastro rápido/completo do CCM.

Nenhuma dessas é removida.

## Funções/RPCs exclusivas de discipulado (DROP)

`handle_discipleship_case_insert`, `sync_discipleship_progress_congregation`,
`enforce_discipleship_case_conclusion`, `touch_case_from_progress`,
`get_discipleship_dashboard`, `ensure_discipleship_case_has_active_modules`,
`is_negative_contact_outcome`, `classify_discipleship_criticality`,
`refresh_discipleship_case_criticality`,
`refresh_discipleship_case_criticality_daily`, `sync_contact_attempt_context`,
`handle_contact_attempt_change`, `handle_discipleship_calendar_change`,
`handle_discipleship_case_criticality_init`,
`search_ccm_members_for_discipleship`, `list_ccm_discipleship_cases_summary`,
`get_discipleship_without_case_snapshot`, `list_ccm_members_for_discipleship`,
`create_ccm_member_from_discipleship`,
`update_ccm_member_profile_from_discipleship`,
`promote_case_status_on_first_enrollment`, `derive_confraternizacao_status`,
`apply_confraternizacao_status`, `sync_confraternizacao_from_calendar`,
`get_active_confraternizacao`, `refresh_discipleship_case_attendance`,
`handle_discipleship_case_attendance_from_chamada`,
`log_discipleship_chamada_timeline`, `is_discipulado_user`.

Mais `is_member_department_eligible`, `enforce_department_eligibility` e
`enforce_discipleship_role_isolation` (existem só por causa do discipulado,
mesmo vivendo em tabelas do CCM — ver riscos críticos).

`is_congregation_active`, `is_admin_master`, `get_my_context` **não são
tocadas** — infraestrutura CCM central.

## Policies RLS deixadas como estão (cláusula fica inerte, não referencia tabela derrubada)

`pessoas_read` (cláusula `NOT has_role([...discipulado...])`),
`departamentos_read/manage`, `pessoa_departamento_read/manage`,
`departamentos_publicos_manage`, `departments/department_roles/
department_contacts/department_faq_manage_admin`,
`integracao_read/manage`, `batismos_read/manage`, `timeline_read`.

## Policies removidas (referenciam tabela de discipulado, ficariam quebradas)

`pessoas_read_discipulado_bridge`, `pessoas_delete_discipulado_bridge`.

## Roles de discipulado

`DISCIPULADOR`, `SM_DISCIPULADO`, `ADMIN_DISCIPULADO`,
`SECRETARIA_DISCIPULADO` — fazem parte do CHECK constraint
`usuarios_perfis_role_check` (definição final na 0037) junto aos roles do
CCM. Esta mudança **não altera o constraint** (deixaria os 4 valores ainda
permitidos, mas sem nenhuma tela para atribuí-los); apenas desativa
(`active = false`) quaisquer linhas existentes com esses roles.

`CADASTRADOR` aparece em migrations de discipulado mas é role do próprio CCM
(rota `/cadastro`, migrations `0020`, `0039`, `0068`, `0071`) — não remover.

## Arquivos de código — ver lista completa em `proposal.md`
