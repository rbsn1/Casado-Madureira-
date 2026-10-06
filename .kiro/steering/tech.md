# Tech Stack

## Core

- **Framework:** Next.js 14 (App Router, React Server Components)
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js 20+
- **Backend:** Supabase — Postgres, Auth, Edge Functions, RLS policies

## Frontend

- **Styling:** Tailwind CSS v3 with a custom design token system (CSS variables mapped to semantic color names)
- **UI components:** Custom primitives in `src/components/ui/` (Button, Input, Modal, Card, Badge, etc.)
- **Icons:** Inline SVG glyphs — no icon library dependency
- **Class merging:** `clsx` for conditional className composition

## Key Libraries

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Supabase client (browser + server) |
| `read-excel-file` | Parsing `.xlsx` import files |
| `clsx` | Conditional class merging |

## Supabase Clients

- `src/lib/supabaseClient.ts` — browser client using the anon key (nullable if env vars missing)
- `src/lib/supabaseAdmin.ts` — server-only admin client using the service role key
- `src/lib/serverAuth.ts` — server-only auth helpers (`requireAdmin`, `requireUserManagementAdmin`)
- Never import `supabaseAdmin` or `serverAuth` in client components

## Auth & Roles

- Client-side scope: `src/lib/authScope.ts` → `getAuthScope()` — cached for 15 s, calls `get_my_context` RPC
- Server-side: Bearer token validated against Supabase, then roles checked in `usuarios_perfis`
- Hook: `src/hooks/useAuth.ts` for simple user/role state in React components

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never expose to client
NEXT_PUBLIC_APP_ORIGIN=           # optional, used in CORS allowed origins
```

## Database Migrations

Numbered SQL files in `supabase/migrations/` (e.g. `0082_...sql`). Always increment sequentially. Apply via Supabase CLI.

## Edge Functions

Located in `supabase/functions/`. Currently: `enqueue-welcome`, `smooth-worker` (WhatsApp pipeline).

## Common Commands

```bash
# Development
npm run dev          # start Next.js dev server (port 3000)

# Production
npm run build        # build for production
npm start            # start production server

# Linting
npm run lint         # run ESLint (next lint)

# Supabase (requires Supabase CLI)
supabase db push     # apply pending migrations to remote
supabase functions deploy <name>  # deploy an edge function
```
