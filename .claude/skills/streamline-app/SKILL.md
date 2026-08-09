---
name: streamline-app
description: Use this skill whenever the user wants to improve this app's UX flow, make a screen or the product feel more professional/polished, or asks to find and remove unused code, dead screens, duplicate components, or unnecessary complexity. Trigger on phrases like "deixa mais profissional", "limpa o que não usa", "simplifica esse fluxo", "revisa o app", "audita o código", "isso tá complicado demais", or whenever the user describes friction, clutter, redundancy, or confusion in how a screen or flow works — even if they don't explicitly say "cleanup" or "audit". Also trigger proactively before starting any broad refactor, so the work gets scoped through a written proposal instead of made ad hoc.
---

# Streamline the app

This project accumulates the normal way apps do: a feature gets bolted on, a
module gets abandoned mid-build, two screens end up doing almost the same
thing, a "temporary" workaround becomes permanent. None of that is a
one-time cleanup — it's a recurring pass. This skill is that pass: find what
no longer earns its place, and improve what remains so the product feels
intentional rather than accreted.

Two failure modes to avoid in equal measure: doing nothing because a full
audit feels too big, and doing too much because a small ask ("simplify this
screen") quietly turns into an unreviewed rewrite of half the app. This
skill's shape — audit, prioritize with the user, propose, apply carefully —
exists to prevent both.

## Phase 1 — Audit

Don't start editing. Start by building an honest inventory of what's
actually there versus what's actually used. Concrete signals that work well
in a Next.js/Supabase-style codebase (adjust for whatever stack you're in):

- **Monolithic files.** `wc -l` across `src` sorted descending. A page or
  component north of ~600-800 lines mixing data-fetching, business logic,
  and JSX in one function is a refactor candidate, not a style preference —
  it's the thing that makes every future change to that screen riskier than
  it needs to be.
- **Dead code.** For each component/lib file, grep the rest of the codebase
  for its basename as an import specifier. Zero hits (accounting for
  directory-style imports that resolve through an `index.ts` barrel file —
  check those separately before calling something orphaned) means it's
  unreachable. Confirm with a second grep for the exported symbol names
  themselves, not just the file path, in case something re-exports it.
- **Duplicated logic.** The same small utility (a slugify, a date formatter,
  a phone parser) reimplemented inline in two places instead of imported
  from the one lib file that already has it. Usually surfaces while
  grepping for something else — keep a running list rather than a dedicated
  pass.
- **Redundant flows.** Two screens/components that do essentially the same
  job (two login forms, two "are you sure" modals with different copy). Grep
  for repeated literal strings (page titles, button labels) across `src` —
  clusters of near-identical UI text are a strong signal.
- **Unreachable permission paths.** A role, flag, or feature-gate that
  nothing can ever satisfy anymore (e.g. a role no one can be assigned, an
  env-gated branch for a provider that was removed). These are worth
  flagging even though they don't cost bundle size — they're the thing that
  makes the next engineer assume a code path is live when it isn't.
- **Dependency health.** `npm audit` and a scan for deprecated/EOL major
  versions. A vulnerability in a library that's actually exercised by user
  input (file import/export, anything parsing untrusted data) outranks
  almost everything else on this list.
- **UX friction, not just code smell.** Walk the flow as a user would: how
  many steps to do the common task, how many screens say "not available yet"
  or point at something that no longer exists, where does branding/copy feel
  like leftover marketing rather than what the product now is. This is the
  harder-to-grep half of the audit — it usually comes from the user
  describing what bugs them, or from actually clicking through the app.

Delegate the wide mechanical search (line counts, cross-referencing every
file's importers, npm audit) to a subagent when it's more than a few greps —
keep your own context for judgment calls, not for scrolling through file
listings.

## Phase 2 — Prioritize with the user, don't dump a wall of findings

A raw audit is usually too much to act on at once, and some of it will be
wrong (a file that looks dead might be loaded through a path your grep
missed; a "duplicate" screen might serve a different role than it looks
like). Before proposing anything:

1. Group findings by category (dead code / duplication / monolithic files /
   dependency risk / UX friction) and rough risk-to-fix (safe deletion vs.
   "this touches a shared table/component").
2. Present the groups with enough specificity to be checkable — exact file
   paths and line counts, not vague claims — and a plain-language read on
   the tradeoff, not just a list.
3. Ask the user what to tackle first rather than assuming. When there are
   several independent categories, a multi-select question ("dead code" /
   "dependency vulnerabilities" / "refactor page X" / "just register the
   findings") works better than picking for them — priorities here are
   product judgment, not something inferable from the code alone.

Small, obviously-safe fixes (a one-line typo, an unused import) don't need
this ceremony — see the `spec` skill's own escape hatch for that. Everything
else does.

## Phase 3 — Propose before touching code

Route every non-trivial change through the **`spec` skill**
(`explore → propose → apply → archive`). Don't edit ad hoc past what Phase 2
scoped. For each change:

- `propose` a `changes/<name>/proposal.md` with **Why / What Changes /
  Impact**, same as any spec change — but for this kind of work, the
  **"what's explicitly left alone"** part of Impact matters as much as
  what's changing. State it, don't leave it implicit. If cleaning up a
  screen means some adjacent feature is now unreachable or under-served
  (e.g. removing a module leaves a related management screen with nowhere
  to go), that's a decision for the user, not something to paper over
  silently — surface it as an open question in `explore`, not as a
  fait accompli in the proposal.
- Keep structural changes and behavior changes in separate proposals where
  practical. "Reorganize this component into hooks/lib/UI pieces, same
  behavior" is a much lower-risk review than "reorganize and change how it
  works" — bundling them makes it hard to tell which part introduced a
  regression if something breaks.
- If `apply` uncovers something the proposal didn't account for (a second
  place that imports the file you're deleting, a table with no migration
  backing it in this repo, a shared component that turns out not to be
  shared) — stop and fold it into the plan explicitly rather than quietly
  expanding scope. Small in-scope discoveries (an extra file with the exact
  same dead-code signature as ones already approved) are fine to absorb and
  note; discoveries that touch something outside what was approved (shared
  infrastructure, a different table, live user data) go back to the user
  first.

## Phase 4 — Database changes get extra caution

Everything in the `spec` skill applies, plus:

- **The migration files in the repo are not the ground truth for what's in
  the live database.** Schema drift happens — migrations applied out of
  band, objects created by hand in the SQL editor, a second draft schema
  built directly against the same project with no migration ever written
  for it. Before assuming a table/function is safe to touch, check what's
  *actually there* (`information_schema`, `pg_policies`, `pg_depend`), not
  just what the migration history implies.
- **Naming and file organization are not proof of isolation.** A table that
  "looks like" it belongs to the feature being removed can still be
  load-bearing for something else (an enum type shared with a core
  permission function, a policy on an unrelated shared table referencing a
  helper you're about to drop). Trace real dependencies — `pg_depend`,
  `pg_get_functiondef`, `pg_policies.qual`/`with_check` — before writing a
  `DROP`. A dependency check that only looks at table columns will miss
  function parameter/return types and policy expressions; check those too.
- **Never hand-run destructive SQL directly.** Write the migration as a
  file, `supabase db push --dry-run` to confirm exactly what would apply and
  in what order, then push for real. This also means every destructive
  change is versioned and reviewable, not a one-off command that leaves no
  trace.
- **A created migration is not an applied migration.** Creating the `.sql`
  file is part of `apply`. Running it against a real database — especially
  one that isn't obviously a scratch/dev project — is a separate, explicit
  step that needs the user's go-ahead each time, even if they approved the
  proposal that produced the file.
- **Lean on transactional DDL.** `supabase db push` runs each migration
  file in one transaction — if a `DROP` fails partway through, everything
  in that file rolls back. That's a safety net, not a reason to skip
  planning: after any failed push, verify the rollback actually happened
  with a direct read query before touching the migration file again, don't
  just assume.
- **If a change reaches a table or function used outside the feature being
  cleaned up** (a shared multi-tenant table, a core permission function, a
  role-check used elsewhere) — stop and confirm with the user before
  proceeding, even if the specific policy/column being touched looks
  unreachable today. "Currently unreachable" and "safe to remove" are not
  the same claim.

## Phase 5 — Verify, then close the loop

- Run the project's real build and lint, not just a type-check. If the
  local Node version can't run the project's own tooling (a real failure
  mode, not hypothetical), find a working version rather than skipping
  verification.
- If a build fails in a way that looks like tooling flakiness (different
  pages fail on each run, the error references bundler internals rather
  than your code, `lint` and `tsc` are clean) — rerun it once or twice
  before concluding it's a real bug. Non-deterministic failures across
  identical reruns are an environment signal, not a code signal; don't
  "fix" real code to chase a flaky build.
- Once a change is verified and the user is satisfied, `archive` it per the
  `spec` skill so `specs/<domain>/spec.md` reflects the app as it now
  behaves — the whole point of this pass is that the next audit starts from
  a smaller pile, not the same one.
