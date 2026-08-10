# Automação do acompanhamento de novos contatos via WhatsApp

## Por que

Hoje existem dois caminhos pelos quais uma pessoa é "chamada para casar com
a Madureira":

1. **Ficha em papel** → um cadastrador digita nome/telefone no app
   (`/cadastro`). Essas pessoas viram registros em `pessoas`.
2. **QR code → grupo do WhatsApp** direto, sem passar pelo app. Essas
   pessoas **não têm nenhum registro no sistema hoje**.

O QR code precisa continuar indo direto para o grupo (restrição confirmada
com o usuário — não é algo que pode mudar). Como o WhatsApp não expõe uma
API para "alguém entrou no grupo", não existe forma de capturar essas
pessoas automaticamente — a equipe precisa olhar a lista de participantes
do grupo e registrar manualmente. O objetivo aqui é tornar esse registro o
mais rápido possível, e a partir do momento em que a pessoa **está** no
sistema (por qualquer um dos dois caminhos), automatizar o resto: mensagem
de boas-vindas imediata e uma segunda mensagem, um dia depois, apresentando
os departamentos da igreja — para não perder o contato até a reunião
presencial.

**Diagnóstico do estado atual** (investigado nesta sessão): a
infraestrutura de envio de WhatsApp já existe neste projeto
(`church_settings`, `contacts`, `message_jobs`, a Edge Function
`smooth-worker`, secrets do Meta configurados), mas **nunca funcionou de
ponta a ponta**:

- `contacts`, `church_settings` e `message_jobs` estão com **zero linhas**
  — nada nunca populou `contacts` a partir de `pessoas`, e ninguém
  configurou o link do grupo/template.
- Não existe nenhum cron rodando a `smooth-worker` — o `docs/whatsapp-cloud-api.md`
  descreve um workflow do GitHub Actions a cada 2 minutos, mas ele nunca foi
  criado neste repositório.
- A Edge Function `enqueue-welcome`, citada no mesmo doc, nunca foi
  publicada (404) — a lógica de enfileirar foi reimplementada na rota
  `/api/admin/whatsapp/enqueue` do Next.js, tornando essa function obsoleta.

Ou seja: não é um ajuste fino em algo que funciona, é fechar uma corrente
que nunca chegou a se conectar.

## Arquitetura

Trocamos o design original (GitHub Actions externo, polling a cada 2
minutos) por primitivas nativas do Supabase:

- **Database Webhook** em `message_jobs`: dispara a `smooth-worker`
  imediatamente quando um job é inserido. Cobre o caso comum (mensagem de
  boas-vindas, `scheduled_at` = agora) com latência quase zero.
- **`pg_cron`**, rodando a cada poucos minutos dentro do próprio Postgres:
  varre jobs pendentes vencidos. Cobre o job de departamentos (agendado
  para +1 dia) e serve de rede de segurança para qualquer coisa que o
  webhook não pegue.
- A `smooth-worker` já filtra `status = 'PENDENTE' and scheduled_at <= now()`,
  então não precisa mudar essa parte — ela já ignora jobs que ainda não
  venceram, mesmo se o webhook a acordar cedo demais.
- Isso elimina a dependência de um repositório/secret externo (GitHub
  Actions) e reduz a latência do envio imediato de até 2 minutos para
  quase instantâneo.

## Componentes

1. **Trigger em `pessoas`** (nova function + trigger), disparado só quando
   `cadastro_origem = 'ccm'`:
   - Faz upsert em `contacts` (nome, telefone em E.164, `tenant_id` =
     congregação, `opt_in_whatsapp = true`).
   - Insere um `message_jobs` tipo `welcome`, `scheduled_at = now()`.
   - Insere um segundo `message_jobs` tipo `departments`,
     `scheduled_at = now() + interval '1 day'`.
   - **Nunca bloqueia o INSERT em `pessoas`** — qualquer erro na parte de
     WhatsApp é capturado dentro da function e não propaga; o cadastro da
     pessoa é a prioridade, a mensagem é conveniência.
2. **Migration**: adicionar `'departments'` aos valores aceitos em
   `message_jobs.type` (hoje só aceita `'welcome'`).
3. **Ajuste na `smooth-worker`**: hoje monta os parâmetros do template de
   forma fixa (`[nome, link_do_grupo]`, específico do template
   `welcome_ccm`). Generalizar para ler `payload.templateParams: string[]`
   do próprio job, com fallback para `[nome, link_do_grupo]` quando ausente
   (mantém compatibilidade com os jobs `welcome` existentes).
4. **Database Webhook** (Supabase, configurado no dashboard ou via
   migration): `AFTER INSERT on message_jobs` → `POST` para a
   `smooth-worker` com o header `X-WORKER-TOKEN`.
5. **`pg_cron`**: schedule a cada 5 minutos, chamando a `smooth-worker` do
   mesmo jeito que o webhook.
6. **Tela "Adicionar do grupo"**: formulário enxuto (telefone obrigatório,
   nome opcional) para a equipe registrar rapidamente quem só está no
   grupo. Reaproveita o mesmo caminho de gravação em `pessoas` que o
   cadastro rápido já usa, mas sem exigir culto/data — `culto_origem` já
   aceita `null` no banco, não precisa de mudança de schema.
7. **Novo template do WhatsApp** (Meta Business Manager) para a mensagem de
   departamentos. **A submissão e aprovação no Meta são feitas pelo
   usuário** — é uma conta que só ele tem acesso, e a aprovação do Meta
   costuma levar 1-2 dias úteis. O sistema fica pronto para usar o template
   assim que ele for aprovado; até lá, o job de departamentos fica pendente
   sem erro (usa o nome do template configurado em `church_settings`).

   Rascunho sugerido (categoria UTILITY, `pt_BR`, nome sugerido
   `departamentos_ccm`), com 3 parâmetros — os 3 primeiros departamentos
   ativos em `departamentos.nome`, na ordem de cadastro:

   > Oi {{1}}! Além do grupo, a Madureira tem vários departamentos onde
   > você pode servir e fazer parte: {{2}}, {{3}} e {{4}}, entre outros.
   > Quando a gente se encontrar pessoalmente, te conto mais sobre cada um
   > e você escolhe onde se identifica mais. Até breve!

   ({{1}} = nome da pessoa, {{2}}/{{3}}/{{4}} = 3 departamentos ativos.)
   Ajustar o texto livremente antes de submeter — o que importa para a
   implementação é a contagem de parâmetros bater com
   `payload.templateParams`.
8. **Configurar `church_settings`** pela primeira vez para a congregação
   "Sede" (link do grupo + nomes dos templates). **Pendente**: preciso do
   link do grupo do WhatsApp para preencher isso — configuro assim que
   tiver essa informação.

## Fluxo de dados

```
Ficha (/cadastro) ──┐
                     ├─→ pessoas (cadastro_origem='ccm')
Adicionar do grupo ──┘         │
                                ▼
                     trigger sync_pessoa_to_whatsapp
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              upsert contacts      insere 2 message_jobs
                                    (welcome agora, departments +1d)
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
              Database Webhook dispara                      pg_cron varre a cada 5min
              smooth-worker na hora                          (pega o que venceu)
                        │                                               │
                        └───────────────────┬───────────────────────────┘
                                             ▼
                                   smooth-worker envia via
                                   WhatsApp Cloud API
                                   (até 3 tentativas)
                                             │
                                  status: ENVIADO ou ERRO
```

## Tratamento de erro

- Falha ao criar `contacts`/`message_jobs` nunca impede o cadastro da
  pessoa (ver componente 1).
- Reenvio automático (até 3 tentativas) já existe na `smooth-worker` — sem
  mudança.
- Duplicidade: o cadastro já valida telefone duplicado por congregação no
  fluxo existente; então recadastrar a mesma pessoa não deve gerar
  mensagens duplicadas — confirmar durante a implementação, sem mudança de
  design esperada.
- Falhas definitivas (3 tentativas esgotadas) ficam com status `ERRO`,
  visíveis em `/admin/whatsapp` para revisão manual.

## Teste

Sem suíte automatizada no projeto. Verificação prevista:

- Usar o **modo TESTE** já existente no sistema (`dispatch_mode: "TESTE"` +
  `test_phone_e164`) para validar o envio de ponta a ponta sem risco de
  mandar mensagem errada para um contato real.
- Verificar diretamente no banco (consulta SQL) que o trigger cria
  `contacts` e os dois `message_jobs` corretamente após um cadastro de
  teste.
- Verificar que o Database Webhook e o `pg_cron` de fato disparam a
  `smooth-worker` (chamada HTTP observável/log).
- Confirmar que uma falha simulada na parte de WhatsApp não impede o
  `INSERT` em `pessoas`.

## Fora de escopo

- Mudar o QR code para não ir direto ao grupo (descartado, restrição do
  usuário).
- Qualquer forma de ler automaticamente a lista de participantes do grupo
  do WhatsApp (não existe API pública/oficial para isso).
- Página pública listando departamentos (o usuário optou por texto direto
  na mensagem do WhatsApp, sem link para nova tela).
- Investigar a Edge Function órfã `bright-function`, encontrada durante o
  diagnóstico mas sem relação com este fluxo.

## Pendências antes da implementação

1. Link do grupo do WhatsApp, para configurar `church_settings`.
2. Texto final do template de departamentos, para submissão no Meta
   Business Manager pelo usuário (aprovação fora do meu controle).
