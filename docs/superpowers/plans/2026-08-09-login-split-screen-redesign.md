# Login Split-Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/acesso-interno` (the app's one real login screen — `/login` is just a redirect to it) a premium split-screen visual: a deep-blue gradient brand panel on desktop, collapsing to a compact top band on mobile, with a cleaner, more spacious form on the other side.

**Architecture:** One new presentational component (`AuthSplitLayout`) replaces `PortalBackground` on this single page. `LoginForm` (existing, unchanged logic) gets two small style tweaks that apply wherever it's rendered. No new dependencies, no routing changes, no behavior changes.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind CSS 3, TypeScript. No test framework exists in this repo (`package.json` has no `test` script) — verification is `npm run lint` + `npm run build` (both must run under Node 20; the system default Node is v12 and cannot run this project's tooling — always `export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20` first) plus a manual visual check via headless-Chrome screenshots at two widths, matching how every prior change in this project has been verified.

## Global Constraints

- Node 20 via nvm for every `npm run lint` / `npm run build` invocation — the system Node (v12) crashes both.
- Design tokens only — no raw Tailwind colors (`slate-*`, `blue-*`, etc.). Use the existing tokens: `brand-*` scale, `text`, `text-muted`, `border`, `bg`, `surface`, `accent-*`. Reference: `tailwind.config.ts`.
- `PortalBackground` (`src/components/layout/PortalBackground.tsx`) must not be modified — it's still used unchanged by `/agenda`, `/conta`, `/cadastro/completar`.
- `/login` (`src/app/(public)/login/page.tsx`) is out of scope — it's a `redirect("/acesso-interno")` stub and stays that way.
- `LoginForm` (`src/components/auth/LoginForm.tsx`) keeps its exact current props (`showRememberMe?: boolean`) and behavior — only two Tailwind classes change.
- Spec: `docs/superpowers/specs/2026-08-09-login-split-screen-redesign-design.md`.

---

### Task 1: Create `AuthSplitLayout`

**Files:**
- Create: `src/components/layout/AuthSplitLayout.tsx`

**Interfaces:**
- Produces: `AuthSplitLayout` — a named export, React component with props `{ children: ReactNode; label: string; tagline: string }`. `children` renders in the right column. `label` is the small uppercase line next to the logo mark (both breakpoints). `tagline` is a longer sentence shown only at `lg:` and up.

- [ ] **Step 1: Write the component**

```tsx
import { ReactNode } from "react";

type AuthSplitLayoutProps = {
  children: ReactNode;
  label: string;
  tagline: string;
};

export function AuthSplitLayout({ children, label, tagline }: AuthSplitLayoutProps) {
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[42%_1fr]">
      <div className="relative flex h-[104px] items-center overflow-hidden bg-[linear-gradient(160deg,#1E3A5F_0%,#16304e_60%,#0f1e31_100%)] px-6 lg:h-auto lg:flex-col lg:items-start lg:justify-between lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(76,123,163,0.55),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_80%,rgba(230,167,86,0.28),transparent_50%)]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white ring-1 ring-white/20">
            CM
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
            {label}
          </p>
        </div>
        <p className="relative z-10 hidden text-lg font-semibold leading-snug text-white lg:block">
          {tagline}
        </p>
      </div>
      <div className="flex items-center justify-center bg-bg px-4 py-10 lg:px-16 lg:py-16">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
```

Notes on the values used (so the next person doesn't have to reverse-engineer them):
- The gradient (`#1E3A5F → #16304e → #0f1e31`) and the two radial glows (`rgba(76,123,163,…)` blue, `rgba(230,167,86,…)` gold) are the exact values approved in the visual-companion brainstorm — they're one-off arbitrary values, not tokens, because they're a decorative gradient rather than a reusable UI color.
- `h-[104px]` is the mobile brand-panel band height; `lg:h-auto` lets it stretch to full column height on desktop via the parent's `lg:grid lg:min-h-screen` (grid items stretch to row height by default).
- The right column's `max-w-lg` (up from the old card's `max-w-md`) is the "more spacious form" call from the design doc.

- [ ] **Step 2: Verify it type-checks and lints clean in isolation**

Run:
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
npx tsc --noEmit -p tsconfig.json
npm run lint
```
Expected: no new errors mentioning `AuthSplitLayout.tsx` (the file isn't imported anywhere yet, so it won't affect the build, only the linter/type-checker, which check all files regardless of usage).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AuthSplitLayout.tsx
git commit -m "Add AuthSplitLayout component for premium login layout"
```

---

### Task 2: Style tweaks to `LoginForm`

**Files:**
- Modify: `src/components/auth/LoginForm.tsx:94` (form spacing), `src/components/auth/LoginForm.tsx:132` (submit button)

**Interfaces:**
- Consumes: nothing new — no prop or signature changes.
- Produces: same `LoginForm({ showRememberMe }: { showRememberMe?: boolean })` export, visually taller field spacing and a taller/shadowed submit button. Any page rendering `<LoginForm />` picks this up automatically, including `/acesso-interno` (Task 3) with no code change on the consuming side.

- [ ] **Step 1: Widen the field spacing**

In `src/components/auth/LoginForm.tsx`, change:

```tsx
    <form className="space-y-4" onSubmit={handleSubmit}>
```

to:

```tsx
    <form className="space-y-6" onSubmit={handleSubmit}>
```

- [ ] **Step 2: Raise and shadow the submit button**

In the same file, change:

```tsx
      <Button type="submit" className="w-full" disabled={status === "loading"}>
```

to:

```tsx
      <Button type="submit" className="w-full h-12 shadow-lg shadow-brand-900/10" disabled={status === "loading"}>
```

- [ ] **Step 3: Lint**

Run:
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
npm run lint
```
Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/LoginForm.tsx
git commit -m "Widen LoginForm spacing and raise submit button for premium look"
```

---

### Task 3: Switch `/acesso-interno` to `AuthSplitLayout`

**Files:**
- Modify: `src/app/(public)/acesso-interno/page.tsx` (full-file rewrite — it's currently 33 lines)

**Interfaces:**
- Consumes: `AuthSplitLayout` from Task 1 (`{ children, label, tagline }`), `LoginForm` (existing, `{ showRememberMe }`).
- Produces: nothing new for other files — this is a leaf page component.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/app/(public)/acesso-interno/page.tsx` with:

```tsx
"use client";

import { AuthSplitLayout } from "@/components/layout/AuthSplitLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export default function AcessoInternoPage() {
  return (
    <AuthSplitLayout
      label="Acesso interno"
      tagline="Acompanhe cadastros, relatórios e times em um só lugar."
    >
      <h1 className="text-3xl font-semibold text-text">Entre no painel</h1>
      <p className="mt-2 text-sm text-text-muted">
        Utilize seu e-mail institucional para acompanhar cadastros, relatórios e times.
      </p>
      <div className="mt-6">
        <LoginForm showRememberMe />
      </div>
    </AuthSplitLayout>
  );
}
```

This drops the `PortalBackground` and `Card` imports/usage entirely (per the
design doc's Impact section — the floating card no longer makes sense once
the brand panel itself provides the visual frame) and drops the old
`<header>` block (its "Acesso interno" label now lives in `AuthSplitLayout`'s
left panel via the `label` prop).

- [ ] **Step 2: Lint and build**

Run:
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
npm run lint
npm run build
```
Expected: both clean, `/acesso-interno` present in the build's route table.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/acesso-interno/page.tsx"
git commit -m "Redesign /acesso-interno with AuthSplitLayout"
```

---

### Task 4: Visual verification

**Files:** none (verification only).

- [ ] **Step 1: Check for another dev server on the port before starting one**

```bash
lsof -i:3010 -sTCP:LISTEN
```
If something is already listening (e.g. another Claude Code session's `next dev` sharing this `.next` build cache), do **not** kill it and do **not** run a second `next dev` against the same `.next` directory — the two dev servers stomp on each other's compiled chunks and produce spurious `MODULE_NOT_FOUND`/404s that look like code bugs but aren't (this happened earlier in this project's history). If the port is busy, use `npm run build && npm run start -- -p 3010` instead — the production server reads a self-consistent `.next` build and doesn't have this problem, at the cost of not hot-reloading.

- [ ] **Step 2: Start a server and confirm it's serving**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
npm run dev -- -p 3010 &
timeout 40 bash -c 'until curl -sf http://localhost:3010/acesso-interno >/dev/null; do sleep 1; done' && echo READY
```

- [ ] **Step 3: Screenshot at mobile width (375px) and desktop width (1440px)**

```bash
google-chrome --headless --disable-gpu --no-sandbox \
  --screenshot=/tmp/acesso-interno-mobile.png \
  --window-size=375,812 --virtual-time-budget=5000 \
  "http://localhost:3010/acesso-interno"

google-chrome --headless --disable-gpu --no-sandbox \
  --screenshot=/tmp/acesso-interno-desktop.png \
  --window-size=1440,900 --virtual-time-budget=5000 \
  "http://localhost:3010/acesso-interno"
```

- [ ] **Step 4: Look at both screenshots and confirm against the spec's acceptance criteria**

Read both PNG files. Confirm:
- Mobile (375×812): brand band at the top is ~104px tall, shows the "CM" mark and "ACESSO INTERNO" label only (no tagline — it's `hidden` below `lg:`), and the full form (both fields + "Manter conectado" + "Esqueci minha senha" + the "Entrar" button) is visible without scrolling.
- Desktop (1440×900): left column (~42% width, ~605px) shows the full gradient panel with both glows, the mark+label at the top, and the tagline sentence near the bottom of the panel. Right column is white, form is comfortably centered with visible breathing room (not cramped against the panel edge).

- [ ] **Step 5: Stop the dev server**

```bash
lsof -ti:3010 -sTCP:LISTEN | xargs -r kill
```

- [ ] **Step 6: If everything matches, this task needs no commit** — it's verification-only. If something doesn't match (e.g. band height wrong, form requires scrolling on mobile), go back to Task 1 or Task 3, fix, and re-run this task from Step 2.
