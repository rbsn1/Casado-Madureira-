# WhatsApp Onboarding Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically capture people who join the CCM WhatsApp group (or are registered via the paper "ficha"), and send them a welcome message immediately plus a departments follow-up one day later — replacing a WhatsApp pipeline that has never actually sent a message because `contacts`/`church_settings`/`message_jobs` were never populated and no cron ever called the worker.

**Architecture:** A Postgres trigger on `pessoas` (fired only for `cadastro_origem = 'ccm'`) upserts a `contacts` row and inserts two `message_jobs` rows (`welcome` now, `departments` in +1 day). A second trigger on `message_jobs` inserts calls a shared `dispatch_whatsapp_worker()` function via `pg_net`, which invokes the existing `smooth-worker` Edge Function immediately. `pg_cron` calls the same dispatch function every 5 minutes as a backstop for jobs that weren't due yet when inserted (the `departments` job) or that the webhook missed. A new lightweight "Adicionar do grupo" screen lets staff register group-only contacts (phone + optional name) through the same trigger path.

**Tech Stack:** Supabase Postgres (migrations, `pg_net`, `pg_cron`, `supabase_vault`), Supabase Edge Functions (Deno, existing `smooth-worker`), Next.js 14 / React / TypeScript (new UI component), Supabase CLI, WhatsApp Cloud API.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-whatsapp-onboarding-automation-design.md` — read it before starting if anything below is unclear.
- The `pessoas` trigger must **never** block or fail the `INSERT` into `pessoas`, even if every downstream step (contacts, jobs, dispatch) fails. Wrap the trigger body in `exception when others` and only `raise warning`.
- No automated test suite exists in this project (confirmed during the design phase). Verification is live SQL queries against the project's Supabase database and manual/curl checks — there is no `pytest`/`jest` step to run.
- Build/lint commands for the Next.js app must use Node 20, not the system Node (v12, incompatible): prefix commands with `export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH" &&`.
- Database connection string (already used throughout this project's history for direct admin work): `postgresql://postgres:gloriadeDeus@1@db.uquhgeunncbjgiqljhgw.supabase.co:5432/postgres`. Supabase project ref: `uquhgeunncbjgiqljhgw`.
- Migration files go in `supabase/migrations/`, named `NNNN_description.sql` continuing from the highest existing number (`0076` is the last one in the repo as of this plan — confirm with `ls supabase/migrations | tail -3` before naming, in case more were added).
- Never commit a real secret value (WhatsApp token, worker token) into a migration file or anywhere in git. Secret values are set via `supabase secrets set` (Edge Function side) and `vault.create_secret` (Postgres side), run directly against the live project — not stored in versioned files.
- Apply migrations with `supabase db push --db-url "<connection string above>" --dry-run` first to confirm exactly what will run, then without `--dry-run` to apply for real. Never hand-run destructive SQL outside a migration file.
- `supabase db push` wraps each migration file in one transaction — if a task's migration fails partway, it rolls back completely. Verify the rollback happened (or the success) with a direct `select` before moving to the next task.

---

### Task 1: Widen schema for the new pipeline

**Files:**
- Create: `supabase/migrations/0077_whatsapp_onboarding_schema.sql`

**Interfaces:**
- Produces: `message_jobs.type` now accepts `'departments'` in addition to `'welcome'`. `contacts` has a unique constraint on `(tenant_id, phone_e164)` that later tasks rely on for `on conflict` upserts. Extensions `pg_net`, `pg_cron`, `supabase_vault` are enabled for later tasks.

- [ ] **Step 1: Confirm the next migration number**

Run: `ls supabase/migrations | tail -3`
Expected: highest file is `0076_...sql` (or higher if something changed — use the next free number and adjust the filename in the steps below accordingly).

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/0077_whatsapp_onboarding_schema.sql`:

```sql
-- Habilita extensões usadas pelo disparo automático de mensagens de
-- onboarding (webhook + varredura periódica via pg_cron, armazenamento
-- seguro do worker token via Vault).
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;

-- Libera o novo tipo de job para a mensagem de departamentos.
alter table public.message_jobs drop constraint if exists message_jobs_type_check;
alter table public.message_jobs
  add constraint message_jobs_type_check
  check (type in ('welcome', 'departments'));

-- Evita contatos duplicados por congregação e permite upsert idempotente
-- a partir do trigger de pessoas.
alter table public.contacts drop constraint if exists contacts_tenant_phone_key;
alter table public.contacts
  add constraint contacts_tenant_phone_key unique (tenant_id, phone_e164);
```

- [ ] **Step 3: Dry-run the migration**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
npx --yes supabase db push --db-url "postgresql://postgres:gloriadeDeus@1@db.uquhgeunncbjgiqljhgw.supabase.co:5432/postgres" --dry-run
```
Expected output includes `0077_whatsapp_onboarding_schema.sql` in the "Would push these migrations" list and nothing else new.

- [ ] **Step 4: Apply the migration**

Run the same command without `--dry-run`, confirming `Y` when prompted.
Expected: `Applying migration 0077_whatsapp_onboarding_schema.sql...` followed by `Finished supabase db push.` with no `ERROR`.

- [ ] **Step 5: Verify directly against the database**

Write a temporary Node script (pattern used throughout this project's history — `pg` package, `npm install --no-save pg` first if not present) that connects with the connection string above and runs:
```sql
select extname from pg_extension where extname in ('pg_net','pg_cron','supabase_vault');
select conname from pg_constraint where conrelid = 'public.contacts'::regclass and conname = 'contacts_tenant_phone_key';
select conname, pg_get_constraintdef(oid) from pg_constraint where conname = 'message_jobs_type_check';
```
Expected: all three extensions listed, the unique constraint exists, and the check constraint definition contains `'departments'`. Delete the temporary script afterward.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0077_whatsapp_onboarding_schema.sql
git commit -m "Widen message_jobs/contacts schema for onboarding automation"
```

---

### Task 2: Rotate the worker token and store it in Vault

**Files:** none (operational step against the live project, no repo files change).

**Interfaces:**
- Produces: a Vault secret named `whatsapp_worker_token` whose decrypted value matches the Edge Function's `WORKER_TOKEN` secret. Task 3's `dispatch_whatsapp_worker()` function reads this by name.

This task deliberately **replaces** the existing `WORKER_TOKEN` rather than trying to read its current value — `supabase secrets list` only exposes a digest, not the raw value, so the only way to get a value both sides agree on is to mint a fresh one and set it in both places.

- [ ] **Step 1: Generate a new token**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output (64 hex characters). Use it verbatim in both steps below — do not regenerate between them.

- [ ] **Step 2: Set it as the Edge Function secret**

Run (replace `<TOKEN>` with the value from Step 1):
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
npx --yes supabase secrets set WORKER_TOKEN="<TOKEN>" --project-ref uquhgeunncbjgiqljhgw
```
Expected: command succeeds with no error. This takes effect on the next `smooth-worker` invocation (no redeploy needed — secrets are read at request time).

- [ ] **Step 3: Store the same value in Vault**

Write a temporary Node script using the `pg` package and the project connection string that runs (with the same `<TOKEN>` value substituted, passed as a query parameter — do not string-concatenate it into the SQL):
```sql
select vault.create_secret($1, 'whatsapp_worker_token', 'Token usado por dispatch_whatsapp_worker() para autenticar com a smooth-worker');
```
using a parameterized query (`client.query(sql, [token])`), so the token never appears in shell history or script source beyond the one-time generation step. Run it, confirm it returns a UUID (the secret id), then delete the temporary script.

- [ ] **Step 4: Verify the secret is readable**

In the same or a follow-up temporary script, run:
```sql
select name, decrypted_secret is not null as has_value from vault.decrypted_secrets where name = 'whatsapp_worker_token';
```
Expected: one row, `has_value = true`. Delete the script when done — do not print or log the decrypted value beyond this one boolean check.

- [ ] **Step 5: No commit**

Nothing in the repo changed. Move directly to Task 3.

---

### Task 3: Create the shared dispatch function

**Files:**
- Create: `supabase/migrations/0078_dispatch_whatsapp_worker_function.sql`

**Interfaces:**
- Consumes: Vault secret `whatsapp_worker_token` (Task 2).
- Produces: `public.dispatch_whatsapp_worker()` — a no-argument, no-return SQL function that later tasks (message_jobs trigger, pg_cron schedule) call to invoke `smooth-worker` over HTTP via `pg_net`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0078_dispatch_whatsapp_worker_function.sql`:

```sql
-- Dispara a Edge Function smooth-worker via pg_net, autenticando com o
-- token guardado no Vault. Não bloqueia o chamador (net.http_post é
-- assíncrono) e nunca lança exceção — se o token não existir ou a chamada
-- falhar, só registra um warning.
create or replace function public.dispatch_whatsapp_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_token text;
  worker_url text := 'https://uquhgeunncbjgiqljhgw.supabase.co/functions/v1/smooth-worker';
begin
  select decrypted_secret into worker_token
  from vault.decrypted_secrets
  where name = 'whatsapp_worker_token'
  limit 1;

  if worker_token is null then
    raise warning 'dispatch_whatsapp_worker: whatsapp_worker_token não encontrado no Vault.';
    return;
  end if;

  perform net.http_post(
    url := worker_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-WORKER-TOKEN', worker_token
    ),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'dispatch_whatsapp_worker falhou: %', sqlerrm;
end;
$$;

grant execute on function public.dispatch_whatsapp_worker() to postgres, authenticated;
```

- [ ] **Step 2: Dry-run and apply**

Same two-step `supabase db push --dry-run` then without, as in Task 1 Steps 3-4. Expected: only `0078_dispatch_whatsapp_worker_function.sql` listed/applied.

- [ ] **Step 3: Verify by calling it directly**

Temporary script, run:
```sql
select public.dispatch_whatsapp_worker();
select id, status_code, created from net._http_response order by created desc limit 1;
```
Expected: the function call succeeds with no error, and `net._http_response` shows a recent row. `status_code` will be `401` at this point — that's expected, because `smooth-worker`'s `WORKER_TOKEN` secret was just rotated in Task 2 and the function is reachable and checking auth correctly. A `401` here proves the plumbing (pg_net → HTTP → smooth-worker) works; it is not yet proof the token matches, since Edge Function secret propagation can take a short time after `supabase secrets set`. If you still see `401` after a minute, re-run `supabase secrets set WORKER_TOKEN=...` with the exact same value used in Task 2 Step 3's Vault insert and retry.

Expected once tokens are in sync: `status_code` between 200-299, or `500` if the WhatsApp Graph API rejects the empty-queue call — either is fine here, since there are no pending jobs yet; what matters is it's not `401`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0078_dispatch_whatsapp_worker_function.sql
git commit -m "Add dispatch_whatsapp_worker() to invoke smooth-worker via pg_net"
```

---

### Task 4: Create the pessoas → contacts/message_jobs trigger

**Files:**
- Create: `supabase/migrations/0079_pessoa_whatsapp_pipeline_trigger.sql`

**Interfaces:**
- Consumes: `public.pessoas` columns `id`, `congregation_id`, `nome_completo`, `telefone_whatsapp`, `cadastro_origem` (all confirmed to exist). `public.departamentos` columns `nome`, `ativo`, `congregation_id`, `created_at`.
- Produces: on `insert into pessoas` where `cadastro_origem = 'ccm'`, a row in `contacts` and two rows in `message_jobs` (`type = 'welcome'` with `scheduled_at = now()`, `type = 'departments'` with `scheduled_at = now() + interval '1 day'`). Does **not** call `dispatch_whatsapp_worker()` directly — that's Task 5's job, triggered off `message_jobs` inserts, so every insert path into `message_jobs` (this trigger, the existing manual enqueue route, anything added later) gets dispatched uniformly.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0079_pessoa_whatsapp_pipeline_trigger.sql`:

```sql
-- Ao cadastrar uma pessoa via CCM (ficha ou tela "Adicionar do grupo"),
-- cria/atualiza o contato de WhatsApp e enfileira as duas mensagens de
-- onboarding. Nunca bloqueia o INSERT em pessoas: qualquer falha aqui é
-- só um warning, o cadastro da pessoa é sempre a prioridade.
create or replace function public.sync_pessoa_to_whatsapp_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_digits text;
  v_name text;
  v_dept_names text[];
begin
  if new.cadastro_origem is distinct from 'ccm' then
    return new;
  end if;

  begin
    v_digits := regexp_replace(coalesce(new.telefone_whatsapp, ''), '\D', '', 'g');
    if v_digits = '' or new.congregation_id is null then
      return new;
    end if;

    v_name := coalesce(nullif(trim(new.nome_completo), ''), 'Irmão(ã)');

    insert into public.contacts (tenant_id, name, phone_e164, opt_in_whatsapp)
    values (new.congregation_id, v_name, v_digits, true)
    on conflict (tenant_id, phone_e164)
    do update set name = excluded.name, updated_at = now()
    returning id into v_contact_id;

    insert into public.message_jobs (tenant_id, contact_id, channel, type, status, payload, scheduled_at)
    values (
      new.congregation_id,
      v_contact_id,
      'whatsapp',
      'welcome',
      'PENDENTE',
      jsonb_build_object(
        'to', v_digits,
        'name', v_name,
        'mode', 'template',
        'templateName', 'welcome_ccm'
      ),
      now()
    );

    select coalesce(array_agg(nome order by created_at asc), '{}'::text[])
      into v_dept_names
    from (
      select nome, created_at
      from public.departamentos
      where ativo is true and congregation_id = new.congregation_id
      order by created_at asc
      limit 3
    ) d;

    insert into public.message_jobs (tenant_id, contact_id, channel, type, status, payload, scheduled_at)
    values (
      new.congregation_id,
      v_contact_id,
      'whatsapp',
      'departments',
      'PENDENTE',
      jsonb_build_object(
        'to', v_digits,
        'name', v_name,
        'mode', 'template',
        'templateName', 'departamentos_ccm',
        'templateParams', to_jsonb(array_prepend(v_name, v_dept_names))
      ),
      now() + interval '1 day'
    );
  exception when others then
    raise warning 'sync_pessoa_to_whatsapp_pipeline falhou para pessoa %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_pessoa_to_whatsapp on public.pessoas;
create trigger trg_sync_pessoa_to_whatsapp
after insert on public.pessoas
for each row execute function public.sync_pessoa_to_whatsapp_pipeline();
```

- [ ] **Step 2: Dry-run and apply**

Same pattern as Task 1 Steps 3-4, for `0079_pessoa_whatsapp_pipeline_trigger.sql`.

- [ ] **Step 3: Verify with a real insert — happy path**

At this point in the plan, Task 5 (the dispatch-on-insert trigger) does not exist yet, so this insert is safe: it cannot trigger a real WhatsApp send. Temporary script:

```sql
insert into public.pessoas (nome_completo, telefone_whatsapp, cadastro_origem, congregation_id, data)
values ('Teste Plano Whatsapp', '(92) 90000-0001', 'ccm', '11111111-1111-1111-1111-111111111111', current_date)
returning id;
-- guarde o id retornado como :test_pessoa_id para os selects abaixo e para a limpeza

select * from public.contacts where phone_e164 = '92900000001';
select type, status, scheduled_at, payload from public.message_jobs
where contact_id = (select id from public.contacts where phone_e164 = '92900000001');
```

Expected: one `contacts` row with `phone_e164 = '92900000001'`, two `message_jobs` rows — one `type='welcome'` with `scheduled_at` at/near now, one `type='departments'` with `scheduled_at` about 24h later. `payload->>'templateParams'` on the departments row should be a JSON array whose first element is `"Teste Plano Whatsapp"`.

- [ ] **Step 4: Verify the failure path doesn't block the insert**

Temporary script, using a congregation_id that doesn't exist (so the `contacts.tenant_id` foreign key fails inside the trigger):
```sql
insert into public.pessoas (nome_completo, telefone_whatsapp, cadastro_origem, congregation_id, data)
values ('Teste Falha Whatsapp', '(92) 90000-0002', 'ccm', '99999999-9999-9999-9999-999999999999', current_date)
returning id;
```
Expected: the `insert` **succeeds** and returns an `id` (proving the pessoa was saved despite the FK failure inside the trigger's exception-wrapped block). Confirm no `contacts`/`message_jobs` row exists for phone `92900000002` (the trigger caught its own error before getting that far).

- [ ] **Step 5: Clean up test data**

```sql
delete from public.message_jobs where contact_id in (select id from public.contacts where phone_e164 in ('92900000001','92900000002'));
delete from public.contacts where phone_e164 in ('92900000001','92900000002');
delete from public.pessoas where telefone_whatsapp in ('(92) 90000-0001','(92) 90000-0002');
```
Delete the temporary script file.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0079_pessoa_whatsapp_pipeline_trigger.sql
git commit -m "Auto-create WhatsApp contact and onboarding jobs when a CCM pessoa is registered"
```

---

### Task 5: Dispatch automatically when a message_jobs row is inserted

**Files:**
- Create: `supabase/migrations/0080_message_jobs_dispatch_trigger.sql`

**Interfaces:**
- Consumes: `public.dispatch_whatsapp_worker()` (Task 3).
- Produces: any `insert into message_jobs` (from Task 4's trigger, or the existing manual `/api/admin/whatsapp/enqueue` route, or anywhere else) now triggers an immediate call to `smooth-worker`. Combined with Task 6's `pg_cron` sweep, this is the "Database Webhook" component from the design.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0080_message_jobs_dispatch_trigger.sql`:

```sql
-- Dispara a smooth-worker imediatamente sempre que um job é enfileirado.
-- A própria smooth-worker já filtra scheduled_at <= now(), então é seguro
-- disparar mesmo para jobs agendados no futuro (ex.: o de departamentos,
-- +1 dia) — ela simplesmente não vai encontrar nada pra processar ainda,
-- e o pg_cron (Task 6) pega quando a data chegar.
create or replace function public.trigger_dispatch_on_message_job_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_whatsapp_worker();
  return new;
end;
$$;

drop trigger if exists trg_dispatch_on_message_job_insert on public.message_jobs;
create trigger trg_dispatch_on_message_job_insert
after insert on public.message_jobs
for each row execute function public.trigger_dispatch_on_message_job_insert();
```

- [ ] **Step 2: Dry-run and apply**

Same pattern as before, for `0080_message_jobs_dispatch_trigger.sql`.

- [ ] **Step 3: Verify the trigger fires**

Temporary script:
```sql
select count(*) from net._http_response where created > now() - interval '1 minute';
insert into public.contacts (tenant_id, name, phone_e164, opt_in_whatsapp)
values ('11111111-1111-1111-1111-111111111111', 'Teste Dispatch', '92900000003', true)
returning id;
-- use the returned id as :dispatch_test_contact_id
insert into public.message_jobs (tenant_id, contact_id, channel, type, status, payload, scheduled_at)
values ('11111111-1111-1111-1111-111111111111', '<dispatch_test_contact_id>', 'whatsapp', 'welcome', 'PENDENTE',
  '{"to":"92900000003","name":"Teste Dispatch","mode":"template","templateName":"welcome_ccm"}'::jsonb, now());
select count(*) from net._http_response where created > now() - interval '1 minute';
```
Expected: the second count is higher than the first (a new HTTP request was made by `net.http_post` as a side effect of the insert).

- [ ] **Step 4: Clean up test data**

```sql
delete from public.message_jobs where contact_id = '<dispatch_test_contact_id>';
delete from public.contacts where phone_e164 = '92900000003';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0080_message_jobs_dispatch_trigger.sql
git commit -m "Dispatch smooth-worker immediately when a message_jobs row is inserted"
```

---

### Task 6: Schedule the pg_cron backstop sweep

**Files:**
- Create: `supabase/migrations/0081_whatsapp_worker_cron_schedule.sql`

**Interfaces:**
- Consumes: `public.dispatch_whatsapp_worker()` (Task 3).
- Produces: a `cron.job` named `whatsapp-worker-sweep` that calls `dispatch_whatsapp_worker()` every 5 minutes, catching the `departments` jobs once they become due and anything the insert-trigger missed.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0081_whatsapp_worker_cron_schedule.sql`:

```sql
-- Varredura de segurança a cada 5 minutos: pega jobs que venceram (ex.: a
-- mensagem de departamentos, agendada pra +1 dia) e qualquer coisa que o
-- trigger de dispatch imediato (0080) não tenha pego.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'whatsapp-worker-sweep') then
    perform cron.unschedule('whatsapp-worker-sweep');
  end if;
end $$;

select cron.schedule(
  'whatsapp-worker-sweep',
  '*/5 * * * *',
  $$select public.dispatch_whatsapp_worker();$$
);
```

- [ ] **Step 2: Dry-run and apply**

Same pattern as before, for `0081_whatsapp_worker_cron_schedule.sql`.

- [ ] **Step 3: Verify the schedule exists**

Temporary script:
```sql
select jobname, schedule, active from cron.job where jobname = 'whatsapp-worker-sweep';
```
Expected: one row, `schedule = '*/5 * * * *'`, `active = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0081_whatsapp_worker_cron_schedule.sql
git commit -m "Schedule pg_cron sweep for pending WhatsApp onboarding jobs"
```

---

### Task 7: Generalize smooth-worker's template parameters

**Files:**
- Modify: `supabase/functions/smooth-worker/index.ts:154-183`

**Interfaces:**
- Consumes: `payload.templateParams?: string[]` (new, optional field on a `message_jobs.payload`).
- Produces: when `payload.templateParams` is present, the WhatsApp template `components[0].parameters` array is built from it directly (any length). When absent, falls back to the existing `[name, groupLink]` shape so the `welcome` job type (which doesn't set `templateParams`) keeps working unchanged.

- [ ] **Step 1: Read the current code to confirm line numbers haven't shifted**

Run: `grep -n "templateName\|providerPayload\|parameters:" supabase/functions/smooth-worker/index.ts`
Confirm the block matches what's quoted in Step 2 below before editing — if it has drifted, adjust the old/new snippet to match what's actually there.

- [ ] **Step 2: Edit the provider payload construction**

Find this block (existing code):
```typescript
        const mode: MessageMode = payload.mode === "template" ? "template" : "text";
        const name = String(payload.name ?? contact.name ?? "").trim() || "Irmão(ã)";
        const groupLink = String(payload.groupLink ?? "").trim();
        const templateName = String(payload.templateName ?? "welcome_ccm").trim() || "welcome_ccm";
        const fallbackText = `Olá ${name}! Seja bem-vindo(a) ao CCM. ${groupLink ? `Entre no grupo: ${groupLink}` : ""}`.trim();
        const textBody = String(payload.text ?? fallbackText).trim() || fallbackText;

        // Template and text share the same provider endpoint; only body shape changes.
        const providerPayload = mode === "template"
          ? {
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: templateName,
                language: { code: "pt_BR" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: name },
                      { type: "text", text: groupLink }
                    ]
                  }
                ]
              }
            }
          : {
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: textBody }
            };
```

Replace it with:
```typescript
        const mode: MessageMode = payload.mode === "template" ? "template" : "text";
        const name = String(payload.name ?? contact.name ?? "").trim() || "Irmão(ã)";
        const groupLink = String(payload.groupLink ?? "").trim();
        const templateName = String(payload.templateName ?? "welcome_ccm").trim() || "welcome_ccm";
        const fallbackText = `Olá ${name}! Seja bem-vindo(a) ao CCM. ${groupLink ? `Entre no grupo: ${groupLink}` : ""}`.trim();
        const textBody = String(payload.text ?? fallbackText).trim() || fallbackText;
        const templateParams: string[] = Array.isArray(payload.templateParams)
          ? payload.templateParams.map((value: unknown) => String(value ?? ""))
          : [name, groupLink];

        // Template and text share the same provider endpoint; only body shape changes.
        const providerPayload = mode === "template"
          ? {
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: templateName,
                language: { code: "pt_BR" },
                components: [
                  {
                    type: "body",
                    parameters: templateParams.map((value) => ({ type: "text", text: value }))
                  }
                ]
              }
            }
          : {
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: textBody }
            };
```

- [ ] **Step 3: Confirm the `payload` type declaration allows the new field**

Run: `grep -n "templateName?:" supabase/functions/smooth-worker/index.ts`
If the payload type (around line 28, per the type shown earlier: `templateName?: string;`) doesn't already have an index signature or `templateParams?: string[]`, add `templateParams?: string[];` to that type definition, next to `templateName?: string;`.

- [ ] **Step 4: Type-check the function**

Run: `cd supabase/functions/smooth-worker && deno check index.ts` if `deno` is available locally; otherwise skip local type-checking and rely on Step 5's deploy step, which fails loudly on type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/smooth-worker/index.ts
git commit -m "Generalize smooth-worker template parameters beyond [name, groupLink]"
```

---

### Task 8: Deploy the updated smooth-worker

**Files:** none (deploy step).

**Interfaces:**
- Consumes: Task 7's updated `supabase/functions/smooth-worker/index.ts`.
- Produces: the live Edge Function now supports `payload.templateParams`, required for the `departments` job type to render correctly.

- [ ] **Step 1: Deploy**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
npx --yes supabase functions deploy smooth-worker --project-ref uquhgeunncbjgiqljhgw
```
Expected: deploy succeeds, reports a new version number higher than the current one (was version 9 as of this plan being written — confirm with `npx --yes supabase functions list --project-ref uquhgeunncbjgiqljhgw` before and after if you want to double check the version incremented).

- [ ] **Step 2: Smoke-test with the existing welcome shape**

Re-run Task 5 Step 3's verification (insert a throwaway `contacts` + `message_jobs` row with `type='welcome'`, no `templateParams`), and check `message_jobs.status`/`last_error` a few seconds later:
```sql
select status, last_error, attempts from public.message_jobs where contact_id = '<the test contact id>';
```
Expected: `status` is not stuck on `PENDENTE` forever (moves to `ENVIADO` or `ERRO` — `ERRO` is acceptable here if it's a WhatsApp-side rejection like invalid phone number, since `92900000003` isn't a real WhatsApp number; what matters is the function ran and updated the row, proving the deploy didn't break the existing path). Clean up the test row afterward.

- [ ] **Step 3: No commit**

Nothing in the repo changed in this task (deploy only).

---

### Task 9: "Adicionar do grupo" quick-add screen

**Files:**
- Create: `src/lib/grupoQuickAdd.ts`
- Create: `src/components/cadastros/AdicionarDoGrupoModal.tsx`
- Modify: `src/app/(app)/cadastros/page.tsx`

**Interfaces:**
- Consumes: `createQuickCcmRegistration` from `src/lib/ccmQuickRegistration.ts` (existing, already used by `CadastroForm.tsx` — same signature: `(supabase: SupabaseClient, input: QuickCcmRegistrationInput) => Promise<QuickCcmRegistrationResult>`, where `QuickCcmRegistrationInput` requires `fullName`, `phoneWhatsapp`, `registeredOn`, `cultoOrigem`, optional `requestId`).
- Produces: `addFromGroup(client: SupabaseClient, input: { phone: string; name?: string }): Promise<{ errorMessage: string | null; duplicate: boolean }>` in `grupoQuickAdd.ts`, and `<AdicionarDoGrupoModal open, onClose, onSaved />` component, wired into `cadastros/page.tsx` next to the existing "Novo cadastro" button.

`createQuickCcmRegistration` requires a `cultoOrigem: CultoOrigemCode`. Check `src/lib/cultoOrigem.ts` for the exact `CultoOrigemCode` type and pick a value that reads sensibly for "came from the WhatsApp group, culto unknown" (e.g., whatever value `CULTO_ORIGEM_CCM_FORM_OPTIONS` uses for a generic/other option — read that file first; if no generic option exists, use the first available option and rely on `nome_completo`/notes to make the origin clear instead of inventing a new enum value).

- [ ] **Step 1: Read the existing quick-registration pieces**

Run: `cat src/lib/cultoOrigem.ts` and `cat src/lib/ccmQuickRegistration.ts` (already read once during this plan's research — re-read to get exact current types before writing code, in case they changed).

- [ ] **Step 2: Write `src/lib/grupoQuickAdd.ts`**

```typescript
import { type SupabaseClient } from "@supabase/supabase-js";
import { createQuickCcmRegistration } from "@/lib/ccmQuickRegistration";
import { parseBrazilPhone } from "@/lib/phone";
import { CULTO_ORIGEM_CCM_FORM_OPTIONS } from "@/lib/cultoOrigem";

export type AddFromGroupResult = {
  errorMessage: string | null;
  duplicate: boolean;
};

function currentLocalDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export async function addFromGroup(
  client: SupabaseClient,
  input: { phone: string; name?: string }
): Promise<AddFromGroupResult> {
  const phoneParsed = parseBrazilPhone(input.phone);
  if (!phoneParsed) {
    return { errorMessage: "Informe o telefone com DDD. Ex: (92) 99227-0057.", duplicate: false };
  }

  const fallbackName = `Contato do grupo (${phoneParsed.formatted})`;
  const fullName = input.name?.trim() || fallbackName;
  const cultoOrigem = CULTO_ORIGEM_CCM_FORM_OPTIONS[0].value;

  const result = await createQuickCcmRegistration(client, {
    fullName,
    phoneWhatsapp: phoneParsed.formatted,
    registeredOn: currentLocalDateInputValue(),
    cultoOrigem,
    requestId: crypto.randomUUID()
  });

  return { errorMessage: result.errorMessage, duplicate: result.duplicate };
}
```

- [ ] **Step 3: Write `src/components/cadastros/AdicionarDoGrupoModal.tsx`**

```typescript
"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatBrazilPhoneInput } from "@/lib/phone";
import { addFromGroup } from "@/lib/grupoQuickAdd";

type AdicionarDoGrupoModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function AdicionarDoGrupoModal({ open, onClose, onSaved }: AdicionarDoGrupoModalProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseClient) {
      setStatus("error");
      setMessage("Supabase não configurado.");
      return;
    }
    setStatus("loading");
    setMessage("");

    const result = await addFromGroup(supabaseClient, { phone, name });

    if (result.errorMessage) {
      setStatus("error");
      setMessage(result.errorMessage);
      return;
    }

    setStatus("idle");
    setPhone("");
    setName("");
    onSaved(
      result.duplicate
        ? "Esse telefone já estava cadastrado — nada duplicado."
        : "Contato adicionado. A mensagem de boas-vindas será enviada em instantes."
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-emerald-900">Adicionar do grupo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Só o telefone já é suficiente — o nome é opcional.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Telefone</span>
            <input
              required
              value={phone}
              onChange={(event) => setPhone(formatBrazilPhoneInput(event.target.value))}
              placeholder="(92) 99227-0057"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Nome (opcional)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Se você souber"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </label>
          {status === "error" ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
            >
              {status === "loading" ? "Salvando..." : "Adicionar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-emerald-200"
            >
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `cadastros/page.tsx`**

Run: `grep -n "openCreate\|toolbarButtonClass}\`" "src/app/(app)/cadastros/page.tsx"` to find the toolbar button row (next to "Novo cadastro rápido" / "Exportar CSV").

Add a new `useState` for the modal's open state near the top of `CadastrosContent`:
```typescript
const [showGroupAdd, setShowGroupAdd] = useState(false);
```

Add the import at the top of the file:
```typescript
import { AdicionarDoGrupoModal } from "@/components/cadastros/AdicionarDoGrupoModal";
```

Add a toolbar button next to the existing "Novo cadastro" button:
```typescript
<button
  onClick={() => setShowGroupAdd(true)}
  className={`${toolbarButtonClass} border border-emerald-300 text-emerald-900 hover:bg-emerald-50`}
>
  Adicionar do grupo
</button>
```

Render the modal near the other conditional sections (alongside `showCreate ? <CadastroForm ... /> : null`):
```typescript
<AdicionarDoGrupoModal
  open={showGroupAdd}
  onClose={() => setShowGroupAdd(false)}
  onSaved={async (message) => {
    setShowGroupAdd(false);
    setFeedbackTone("success");
    setStatusMessage(message);
    await reloadPessoas();
  }}
/>
```

- [ ] **Step 5: Build and lint**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
rm -rf .next
npm run build
npm run lint
```
Expected: both succeed with no new errors. If `npm run build` fails intermittently with a bundler-internal error unrelated to these files (seen before in this project on this environment), rerun once or twice before concluding it's a real bug — see Global Constraints.

- [ ] **Step 6: Commit**

```bash
git add src/lib/grupoQuickAdd.ts src/components/cadastros/AdicionarDoGrupoModal.tsx "src/app/(app)/cadastros/page.tsx"
git commit -m "Add lightweight 'Adicionar do grupo' quick-add screen"
```

---

### Task 10: Full end-to-end verification with a real phone number

**Files:** none.

**Interfaces:** none — this is a manual verification task, not a code change.

**This task requires stopping and asking the user for a real WhatsApp phone number they control**, before sending anything. Do not pick a number or guess one.

- [ ] **Step 1: Ask the user for a test phone number**

Confirm explicitly: "Posso mandar uma mensagem de teste real pra esse número: `<number>`? Isso vai criar uma pessoa de teste e dois `message_jobs` reais (welcome agora, departamentos amanhã)." Wait for explicit yes before proceeding.

- [ ] **Step 2: Insert a real test pessoa through the trigger**

Temporary script, using the confirmed number in place of `<PHONE>`:
```sql
insert into public.pessoas (nome_completo, telefone_whatsapp, cadastro_origem, congregation_id, data)
values ('Teste E2E Onboarding', '<PHONE>', 'ccm', '11111111-1111-1111-1111-111111111111', current_date)
returning id;
```

- [ ] **Step 3: Confirm the welcome message actually arrives**

Wait up to 1 minute (the insert trigger should dispatch near-instantly), then check:
```sql
select type, status, last_error, sent_at from public.message_jobs
where contact_id = (select id from public.contacts where phone_e164 = regexp_replace('<PHONE>', '\D', '', 'g'));
```
Expected: the `welcome` row shows `status = 'ENVIADO'` with a `sent_at` timestamp. Ask the user to confirm the message actually arrived on their phone (status `ENVIADO` means WhatsApp accepted it, not necessarily that it was delivered — a human check is the real confirmation).

- [ ] **Step 4: Confirm the departments template exists (or explain if it doesn't yet)**

If the user has already gotten `departamentos_ccm` approved in Meta Business Manager (from the design doc's pending item), wait for the `+1 day` scheduled time or temporarily note the `departments` job's `scheduled_at` for the user's awareness — do not manually move it earlier to force-test unless the user explicitly asks, since that changes real send timing. If the template isn't approved yet, tell the user plainly: the `departments` job will sit `PENDENTE` until the template is approved and `welcome_template_name`/the hardcoded `'departamentos_ccm'` name in the trigger matches what was actually approved — confirm the approved template name matches what Task 4's migration used, and if Meta required a different name, adjust `templateName` in `sync_pessoa_to_whatsapp_pipeline()` (a small follow-up migration) to match.

- [ ] **Step 5: Clean up the test pessoa (keep or delete per user preference)**

Ask whether to delete the test `pessoas`/`contacts`/`message_jobs` rows or leave them (they're real data now, tied to a real phone number the user chose). Only delete if the user confirms.

- [ ] **Step 6: No commit**

Verification only.
