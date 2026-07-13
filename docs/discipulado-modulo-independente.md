# Especificação — Módulo independente de Discipulado

## Objetivo

Construir uma aplicação web independente para operar o ciclo de discipulado de novos convertidos. Ela não deve importar, consultar ou depender de tabelas, telas, autenticação ou regras do sistema CCM atual.

O produto deve permitir cadastrar pessoas, acolhê-las, encaminhá-las para uma turma, acompanhar módulos e presença, concluir o discipulado e registrar a integração posterior.

## Limites de escopo

Inclua:

- Autenticação e gestão de usuários do próprio módulo.
- Multi-congregação (tenant): cada registro pertence a uma congregação.
- Cadastro de discipulandos, acolhimento, turmas, módulos, aulas e chamadas.
- Painel operacional, indicadores, confraternização e integração pós-discipulado.

Não inclua:

- Cadastros de casais, departamentos, cultos, WhatsApp, agenda ou perfis do CCM.
- Leitura/escrita de `pessoas`, `usuarios_perfis`, `departamentos` ou qualquer API do projeto anterior.
- “Fallbacks” para migrações antigas ou tabelas opcionais. O banco novo deve nascer completo e coerente.

## Stack e convenções

- Next.js (App Router), React, TypeScript estrito e Tailwind CSS.
- Supabase para Auth e Postgres; usar RLS em todas as tabelas expostas.
- Idioma da interface: português do Brasil. Datas em `dd/MM/yyyy`; fuso configurável por congregação.
- Criar migrations incrementais, seed mínimo e `.env.example`. Nunca expor `service_role` no navegador.
- As páginas devem chamar uma camada de repositório/serviço tipada; não espalhar consultas Supabase nos componentes.

## Perfis e permissões

| Perfil | Permissões |
| --- | --- |
| `ADMIN_PLATAFORMA` | Gerencia todas as congregações e seus administradores. |
| `ADMIN_DISCIPULADO` | Administração integral apenas da sua congregação: usuários, catálogo, turmas e operação. |
| `DISCIPULADOR` | Opera acolhimento, turmas atribuídas, módulos, chamadas e integração. Não gerencia usuários nem catálogo global. |
| `SECRETARIA_DISCIPULADO` | Cadastra e edita discipulandos, registra acolhimento e consulta painéis. |
| `SM_DISCIPULADO` | Equivalente à secretaria, com permissão para atribuir responsável e confirmar confraternização. |

As permissões devem ser verificadas no servidor e no RLS. Esconder um botão não substitui a política de banco.

## Modelo de dados

Use UUID, `created_at`, `updated_at` e `congregation_id` em toda entidade operacional. Campos de auditoria devem guardar o usuário que realizou ações relevantes.

### Entidades

| Tabela | Campos essenciais | Regras |
| --- | --- | --- |
| `congregations` | `id`, `name`, `timezone`, `is_active` | Tenant raiz. |
| `profiles` | `id` (FK Auth), `name`, `email`, `congregation_id`, `role`, `is_active` | Um usuário operacional pertence a uma congregação. Administrador de plataforma pode não ter congregação. |
| `disciples` | `id`, `congregation_id`, `full_name`, `phone`, `email`, `birth_date`, `address`, `conversion_date`, `origin`, `notes`, `created_by` | Cadastro próprio do módulo. Telefone único por congregação quando preenchido. |
| `discipleship_cases` | `id`, `disciple_id`, `congregation_id`, `status`, `stage`, `assigned_to`, `welcomed_on`, `notes`, métricas de frequência | Há no máximo um case ativo por discipulando. |
| `module_templates` | `id`, `congregation_id`, `title`, `description`, `sort_order`, `is_active` | Catálogo de etapas da congregação. |
| `case_module_progress` | `case_id`, `module_template_id`, `status`, `started_at`, `completed_at`, `completed_by`, `notes` | Gerado automaticamente ao iniciar o case. |
| `classes` | `id`, `congregation_id`, `name`, `shift`, `is_active` | `shift`: `MANHA`, `TARDE`, `NOITE`, `NAO_INFORMADO`. |
| `class_enrollments` | `class_id`, `disciple_id`, `enrolled_at`, `active` | Um discipulando pode ter uma matrícula ativa. |
| `lessons` | `id`, `class_id`, `date`, `topic`, `module_template_id`, `created_by` | Uma aula por turma e data. |
| `attendance_items` | `lesson_id`, `disciple_id`, `status`, `note`, `marked_at`, `marked_by` | Status: `PRESENTE`, `FALTA`, `JUSTIFICADA`. |
| `contact_attempts` | `id`, `case_id`, `occurred_at`, `outcome`, `note`, `created_by` | Registra contato e subsidia criticidade. |
| `events` | `id`, `congregation_id`, `type`, `date`, `status` | Inicialmente para confraternização. |
| `event_confirmations` | `event_id`, `case_id`, `confirmed`, `attended`, `class_shift` | Uma confirmação por case/evento. |
| `case_events` | `id`, `case_id`, `type`, `description`, `metadata`, `created_by` | Linha do tempo auditável: cadastro, matrícula, módulo, chamada, pausa e conclusão. |
| `post_discipleship` | `case_id`, `integration_status`, `baptism_status`, `department_name`, `notes`, `updated_by` | Integração após a conclusão. Use texto livre para departamento nesta primeira versão. |

### Estados

`discipleship_cases.status`:

- `PENDENTE_MATRICULA`: acolhido, ainda sem turma/matrícula.
- `EM_DISCIPULADO`: possui matrícula ativa e acompanhamento em curso.
- `PAUSADO`: fluxo temporariamente suspenso.
- `CONCLUIDO`: requisitos de graduação atendidos.

`discipleship_cases.stage`:

- `ACOLHIMENTO`, `DISCIPULADO`, `POS_DISCIPULADO`.

`case_module_progress.status`:

- `NAO_INICIADO`, `EM_ANDAMENTO`, `CONCLUIDO`.

## Regras de negócio obrigatórias

1. Ao criar um case, criar automaticamente um progresso para cada módulo ativo da congregação. Caso não exista módulo ativo, bloquear a criação e informar o administrador.
2. Ao criar uma matrícula ativa, promover o case de `PENDENTE_MATRICULA` para `EM_DISCIPULADO` e a etapa para `DISCIPULADO`.
3. Não permitir duas matrículas ativas para o mesmo discipulando, nem mais de um case ativo (`PENDENTE_MATRICULA`, `EM_DISCIPULADO` ou `PAUSADO`).
4. A frequência do case é derivada das chamadas: `presença = presentes / itens com status informado * 100`. Itens `JUSTIFICADA` contam como aula registrada, mas não como presença.
5. Ao criar ou alterar uma chamada, recalcular as métricas do case afetado dentro de uma transação ou por trigger confiável.
6. Só permitir concluir um case quando todos os módulos estiverem concluídos, existir ao menos uma chamada registrada e a frequência for igual ou superior a 75%.
7. Toda alteração de estado, módulo, matrícula, chamada, contato e integração deve gerar um `case_event`.
8. Um usuário comum só pode ler e alterar dados de sua congregação. Um discipulador só pode operar turmas/cases que lhe foram atribuídos, salvo regra explícita do administrador.
9. Exclusão de case concluído deve ser bloqueada. Para dados operacionais, preferir arquivamento/soft delete a exclusão física.
10. O servidor deve validar as transições; a interface apenas orienta o usuário.

## Telas e fluxos

### 1. Login

- Login com email e senha pelo Supabase Auth.
- Redirecionar para o painel do discipulado após autenticação.
- Usuário inativo ou sem perfil recebe mensagem clara e não acessa dados.

### 2. Painel

Exibir, sempre filtrado pela congregação do usuário:

- Quantidade de cases em acolhimento, pendentes de matrícula, em discipulado, pausados e concluídos.
- Indicadores de risco: sem responsável, sem matrícula, baixa frequência (<75%) e ausência de contato recente.
- Distribuição por origem e por responsável.
- Entradas e conclusões no período selecionado.
- Ações recomendadas com links para a lista filtrada.

### 3. Acolhimento / discipulandos

- Lista pesquisável por nome, telefone, status, origem e responsável.
- Formulário para criar e editar discipulando com validação de nome e telefone.
- Ação “Iniciar acolhimento” cria o case em `PENDENTE_MATRICULA` e permite atribuir um responsável.
- Ação de registrar tentativa de contato e exibir criticidade/timeline no detalhe.
- Não tratar pessoas de sistemas externos como fonte de dados.

### 4. Fila de acolhimento

- Kanban por estado: pendente de matrícula, em discipulado, pausado e concluído.
- Filtros por origem, responsável e turno.
- Ações rápidas, de acordo com o perfil: atribuir responsável, matricular em turma, iniciar/pausar fluxo.

### 5. Turmas, módulos e chamada

- CRUD de turmas por congregação e turno.
- Matricular e remover discipulandos; registrar o evento correspondente.
- Criar aula indicando data, tema e módulo opcional.
- Chamada por aluno com presença, falta ou falta justificada e observação.
- Progresso de módulos pode ser atualizado no detalhe do case; a conclusão registra quem e quando concluiu.

### 6. Detalhe do discipulando

Apresentar cadastro, responsável, turma, progresso de módulos, frequência, tentativas de contato, confraternizações, linha do tempo e integração pós-discipulado. As ações devem mostrar por que uma conclusão está bloqueada quando os requisitos não forem atendidos.

### 7. Confraternização

- Administrador cria o evento por congregação e data.
- Operação visualiza confirmados, registra confirmação, presença e turno de ingresso.
- Exportação CSV de confirmados/presentes é permitida para administrador e secretaria.

### 8. Pós-discipulado

- Lista apenas cases concluídos.
- Registrar estado da integração, batismo, departamento em texto e observações.
- Ao iniciar esse acompanhamento, alterar a etapa para `POS_DISCIPULADO` sem alterar o status `CONCLUIDO`.

### 9. Administração

- Administração de congregações: exclusiva de `ADMIN_PLATAFORMA`.
- Administração de usuários: `ADMIN_PLATAFORMA` e `ADMIN_DISCIPULADO` no próprio tenant.
- Catálogo de módulos, regras de frequência e eventos: `ADMIN_DISCIPULADO`.

## API e banco

- Prefira RPCs ou Server Actions para operações que alteram mais de uma tabela: criar case, matricular, registrar chamada, concluir case e registrar integração.
- Cada operação deve validar o usuário, o tenant, os dados de entrada e as transições antes de escrever.
- Criar índices para `congregation_id + status`, `disciple_id`, `assigned_to`, `class_id + date` e busca por nome/telefone.
- Use constraints e triggers para integridade; não dependa apenas de validações do cliente.
- Crie testes de RLS com pelo menos duas congregações para provar que não há leitura cruzada.

## Critérios de aceite

- Um administrador cria uma congregação, módulos e um usuário sem depender de dados externos.
- A secretaria cadastra um discipulando, inicia acolhimento e atribui um responsável.
- O discipulador matricula o discipulando, registra aulas, chamadas e conclui os módulos.
- O sistema bloqueia a conclusão com módulos pendentes, sem chamada ou frequência inferior a 75%.
- Após os requisitos, a conclusão funciona e o case aparece em pós-discipulado.
- Um usuário da congregação A não consegue consultar nem alterar dados da congregação B por interface, API ou Supabase direto.
- A linha do tempo mostra as ações relevantes na ordem correta.

## Ordem de implementação

1. Fundação: projeto, autenticação, perfis, congregações, RLS e testes de isolamento.
2. Catálogo de módulos, discipulandos e cases de acolhimento.
3. Turmas, matrículas, progresso e regras de conclusão.
4. Aulas, chamadas, cálculo de frequência e timeline.
5. Painel, confraternização, pós-discipulado e exportação CSV.
6. Testes de integração, revisão de permissões, estados vazios/erros e documentação de implantação.

## Entregáveis

- Código da aplicação independente.
- Migrations completas e ordenadas, seed de desenvolvimento e política RLS testada.
- `.env.example` e README com execução local, deploy, variáveis necessárias e criação do primeiro administrador.
- Testes unitários para regras de conclusão/frequência e testes de integração para isolamento por congregação.
