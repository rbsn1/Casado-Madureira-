# Project Structure

## Top-Level

```
src/              # Application source code
supabase/         # Database migrations, edge functions, config
public/           # Static assets (icons, manifest, CSV templates)
docs/             # Internal documentation (WhatsApp API, Supabase CLI)
changes/          # Per-change proposals and task lists (planning artifacts)
```

## `src/` Layout

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated route group — wrapped by AppShell
│   │   ├── layout.tsx      # Renders AppShell for all private routes
│   │   ├── page.tsx        # Dashboard (/)
│   │   ├── admin/          # Admin panel (/admin)
│   │   ├── cadastro/       # Single registration form (/cadastro)
│   │   ├── cadastros/      # Registration list (/cadastros)
│   │   ├── relatorios/     # Reports (/relatorios)
│   │   ├── pessoas/        # People management
│   │   ├── novos-convertidos/
│   │   └── manual/         # System manuals
│   ├── (public)/           # Unauthenticated route group
│   │   ├── acesso-interno/ # Internal access / login redirect
│   │   ├── login/
│   │   ├── reset/
│   │   ├── conta/
│   │   ├── agenda/         # Public agenda
│   │   ├── cadastro/       # Public registration form
│   │   └── novos-convertidos/
│   ├── api/                # API Route Handlers (server-only)
│   │   ├── admin/          # Admin endpoints (user management, settings)
│   │   └── settings/
│   ├── globals.css         # Global styles + CSS custom properties (design tokens)
│   └── layout.tsx          # Root layout (html, body, font, metadata)
│
├── components/
│   ├── ui/                 # Primitive UI components (Button, Input, Modal, Card, Badge, etc.)
│   ├── layout/             # App shell and layout wrappers (AppShell, AuthSplitLayout)
│   ├── admin/              # Admin-specific sections
│   ├── auth/               # Login form
│   ├── cadastros/          # Registration-related components
│   ├── cards/              # Stat cards
│   ├── charts/             # Chart components (bar, funnel, monthly)
│   └── shared/             # Reusable cross-module components (StatusBadge, etc.)
│
├── hooks/                  # React hooks
│   ├── useAuth.ts          # Basic auth state (user, role, loading)
│   ├── useAuthScope.ts     # Full role/scope access
│   └── useDashboardData.ts
│
├── lib/                    # Shared utilities and service modules
│   ├── supabaseClient.ts   # Browser Supabase client (nullable)
│   ├── supabaseAdmin.ts    # Server-only admin client
│   ├── serverAuth.ts       # Server-only auth guards
│   ├── authScope.ts        # Client-side role cache (getAuthScope)
│   ├── adminApi.ts         # Admin API call helpers
│   ├── cadastrosApi.ts     # Registration API helpers
│   ├── cadastrosImport.ts  # XLSX import logic
│   ├── cpf.ts              # CPF validation/formatting
│   ├── phone.ts            # Phone/WhatsApp formatting
│   ├── date.ts             # Date utilities
│   └── ...                 # Other domain utilities
│
└── types/                  # Shared TypeScript types
    └── dashboard.ts
```

## `supabase/` Layout

```
supabase/
├── migrations/   # Sequential SQL migration files (0001_init.sql … 0082_…sql)
├── functions/    # Edge Functions (enqueue-welcome, smooth-worker)
├── seed/         # Seed SQL
└── config.toml   # Supabase project config
```

## Key Conventions

- **Route groups** `(app)` and `(public)` control layout and auth boundaries — do not flatten them
- **API routes** live under `src/app/api/` and must always call an auth guard from `serverAuth.ts` before any data access
- **`"use client"`** directive is required on any component using hooks, state, or browser APIs; omit it for Server Components
- **`"server-only"`** is imported at the top of `serverAuth.ts` and `supabaseAdmin.ts` to prevent accidental client-side imports
- **`src/lib/`** is for pure logic and service calls — no JSX
- **`src/components/ui/`** contains only generic, stateless primitives — keep domain logic out
- **Path alias:** `@/` maps to `src/` (configured in `tsconfig.json`)
- **Design tokens** (colors, spacing) are CSS custom properties defined in `globals.css` and consumed via Tailwind semantic names (`brand-*`, `accent-*`, `surface`, `text`, `text-muted`, `border`, `bg`)
