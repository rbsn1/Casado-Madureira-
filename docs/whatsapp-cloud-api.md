# WhatsApp Cloud API (CCM)

## 1) Checklist Meta (Cloud API)
- Criar app no Meta for Developers e ativar WhatsApp Cloud API.
- Obter `PHONE_NUMBER_ID` do número conectado.
- Criar token de acesso de longa duração para envio.
- Publicar/aprovar template `welcome_ccm` em `pt_BR` (se usar modo template).

## 2) Secrets no Supabase Edge Functions
Defina os secrets abaixo no projeto:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION` (opcional, default: `v22.0`)
- `WORKER_TOKEN` (token interno para `X-WORKER-TOKEN`)

Com Supabase CLI (exemplo):

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN="<token>" \
  WHATSAPP_PHONE_NUMBER_ID="<phone_number_id>" \
  WHATSAPP_API_VERSION="v22.0" \
  WORKER_TOKEN="<worker_token>"
```

## 3) Deploy das funções

```bash
supabase functions deploy smooth-worker
supabase functions deploy enqueue-welcome
```

## 4) Execução do worker (cron externo)
Recomendado: rodar a cada 2 minutos.

Endpoint:
- `POST https://uquhgeunncbjgiqljhgw.supabase.co/functions/v1/smooth-worker`

Exemplo de `curl`:

```bash
curl -X POST "https://uquhgeunncbjgiqljhgw.supabase.co/functions/v1/smooth-worker" \
  -H "X-WORKER-TOKEN: <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 5) Exemplo GitHub Actions (a cada 2 min)

```yaml
name: ccm-whatsapp-worker
on:
  schedule:
    - cron: "*/2 * * * *"
  workflow_dispatch:

jobs:
  run-worker:
    runs-on: ubuntu-latest
    steps:
      - name: Call smooth-worker
        run: |
          curl -sS -X POST "https://uquhgeunncbjgiqljhgw.supabase.co/functions/v1/smooth-worker" \
            -H "X-WORKER-TOKEN: ${{ secrets.CCM_WORKER_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

## 6) Fluxo operacional
- Em `/admin/whatsapp`, configure `whatsapp_group_link` e `welcome_template_name` por tenant.
- Selecione período (`date_from/date_to`) e clique em **Enfileirar boas-vindas**.
- Acompanhe os jobs (`PENDENTE`, `ENVIADO`, `ERRO`) na própria tela.
- O worker processa fila e aplica retry automático (até 3 tentativas).
