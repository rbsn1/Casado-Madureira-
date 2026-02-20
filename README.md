# Casados com a Madureira

Aplicacao web do CCM com operacao principal em Next.js + Supabase, incluindo modulo de Discipulado e integracao WhatsApp Cloud API.

## Stack
- Frontend: Next.js 14 + React + TypeScript
- Backend: Supabase (Postgres + Auth + Edge Functions)
- Estilo: Tailwind CSS

## Requisitos
- Node.js 20+
- NPM 10+
- Projeto Supabase ativo

## Configuracao de ambiente
Crie `.env.local` na raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## Executar localmente
```bash
npm install
npm run dev
```

Build de producao:

```bash
npm run build
npm start
```

## Rotas principais
- `/`: dashboard principal
- `/cadastros`: operacao de cadastros
- `/admin`: administracao geral (usuarios, roles e configuracoes)
- `/discipulado`: dashboard do discipulado
- `/discipulado/admin`: administracao do modulo discipulado
- `/admin/whatsapp`: configuracao e enfileiramento de boas-vindas via WhatsApp

## Modelo de acesso (resumo)
- CCM global: `ADMIN_MASTER`, `SUPER_ADMIN`
- Operacao CCM: `PASTOR`, `SECRETARIA`, `NOVOS_CONVERTIDOS`, `LIDER_DEPTO`, `VOLUNTARIO`, `CADASTRADOR`
- Discipulado: `ADMIN_DISCIPULADO`, `DISCIPULADOR`, `SM_DISCIPULADO`, `SECRETARIA_DISCIPULADO`

## Banco e migrations
As migrations SQL ficam em:

- `supabase/migrations`

Fluxo recomendado:

1. Aplicar migrations no projeto remoto
2. Publicar Edge Functions necessarias
3. Validar permissao de roles no ambiente

## Documentacao complementar
- WhatsApp Cloud API: `docs/whatsapp-cloud-api.md`
- Supabase CLI (referencia externa): `docs/supabase-cli.md`

## Notas operacionais
- Nao exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Endpoints administrativos usam token Bearer + validacao de role.
- Se houver erro de permissao no discipulado, valide role ativa em `public.usuarios_perfis` e `congregation_id` quando aplicavel.
