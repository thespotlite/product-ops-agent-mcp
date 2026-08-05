# Engineering Principles

This repo is built to avoid "vibe coding." Product work should feel
creative, but the codebase should feel controlled: clear boundaries,
shared patterns, explicit security, and tests that catch the mistakes
we already paid for.

Use this document as the doctrine. `docs/CODING_STANDARDS.md` turns it
into concrete rules, and `lib/__tests__/` / `scripts/` turn the highest
risk rules into enforcement.

## Core Rules

### DRY - one source of truth

Duplicate business logic is a bug waiting for a second bug.

- Route auth, validation, logging, request IDs, and scoped clients live
  in `createApiHandler()`, not in every route.
- Environment access lives in `lib/env/public.ts` and
  `lib/env/server.ts`, not in ad-hoc `process.env` reads.
- Repeated statuses, role names, permission keys, action labels,
  model IDs, feature flags, colors, and integration names live in a
  constants/catalog module.
- Operator-visible totals and KPIs that appear in more than one place
  come from one server-side projection. Clients render them; they do
  not independently re-sum raw rows.
- Zod schemas live in `lib/validations/` so route files compose shared
  contracts instead of copying validation logic.

### KISS - simple beats clever

Choose the smallest structure that makes the current behavior clear.

- Prefer a function and a test over a framework.
- Prefer a small Postgres RPC for one atomic operation over a general
  workflow engine.
- Prefer a focused static audit over a broad lint plugin when the rule
  is project-specific.
- Prefer boring response envelopes, boring error shapes, and boring
  helper names. Future you should recognize the pattern immediately.

### YAGNI - earn every abstraction

Do not build speculative flexibility.

- Do not add queues, workflow engines, feature flag platforms, custom
  permission systems, or global stores until a real feature needs them.
- Do not promote code to `lib/` until a second feature genuinely needs
  it or it is clearly infrastructure.
- Do not add package dependencies without explicit approval.
- Do not pre-split domains because they might grow. Split when the
  current folder has real, distinct concerns.

## Architecture Principles

### Separation of concerns

- `app/` owns routing and page composition.
- `features/` owns domain behavior and feature-specific components.
- `lib/` owns infrastructure, cross-cutting utilities, auth, env,
  database, validation, hooks, and shared service contracts.
- `components/shared/` and `components/ui/` own reusable interface
  primitives. Do not create one-off variants when a shared primitive
  already expresses the pattern.

### Dependency direction

High-level product code may depend on infrastructure. Infrastructure
does not depend on product features.

- `lib/` never imports from `features/`.
- `features/X` never imports from `features/Y`.
- Shared needs move down into `lib/`, not sideways across feature
  folders.

### Strong globals

Global values are allowed only when they are controlled.

- Env vars are validated centrally and split by browser/server safety.
- Permissions live in a catalog, not scattered conditionals.
- Statuses live in one typed list/map, not repeated strings.
- Design tokens live in one style system, not arbitrary one-off colors.
- Integration config lives in env plus a typed adapter, not in route
  files.

## Security Principles

### Server authorization is authoritative

Client UI can hide buttons for ergonomics, but the server decides.

- API routes are authenticated by default through `createApiHandler()`.
- Public routes must opt out explicitly with `auth: "public"` and have
  a reason that would survive review.
- Cron routes use `createCronHandler()` and constant-time secret
  comparison.
- Authenticated CRUD uses the scoped data client. Direct service-role
  access in an authenticated route needs an inline allowlist reason.
- Row- or record-level database policy is a backstop, not a substitute for
  clear server-side checks.

### Public surfaces leak nothing

- Public errors return safe copy. Raw datastore, vendor API, AI, or database
  messages stay in server logs with request IDs.
- Storage paths are never authorization. Access is granted through the
  owning parent record.
- One-time links, magic links, and email-scannable URLs are not consumed
  on `GET`. Render confirmation on `GET`; mutate on `POST`.

### Rate limits are explicit

Every public, auth-adjacent, AI, upload, expensive, or abuse-prone
route needs a rate-limit decision.

- Durable database-backed limits are preferred for production routes
  because serverless instances do not share memory.
- In-memory limits are acceptable only as temporary local/low-risk
  stopgaps with a documented follow-up.
- Fail-open vs fail-closed must be intentional. If the limiter fails,
  the code should say why the request is allowed or denied.

## Reliability Principles

### Background work has a durability class

Do not hide important failures in `void promise.catch(console.error)`.

- Ephemeral telemetry may use fire-and-forget logging.
- Audit logs, notifications, financial records, and user-visible side
  effects need persisted failure telemetry or a durable outbox.
- Multi-write operations that must succeed or fail together belong in a
  Postgres function invoked through `scoped.rpc()`.
- If a route tells the user "success," the downstream state required to
  make that true must either be committed or durably queued.

### No silent fallbacks

A service may degrade, but it must say so.

- Do not `catch { return [] }` or `catch { return null }` for real
  upstream/database failures.
- Use a discriminated result such as
  `{ ok: true; data } | { ok: false; reason }`.
- UIs render empty, error, loading, and partial states as distinct
  states. Operators should never wonder whether "nothing here" means
  "nothing exists" or "the query failed."

## Testing Principles

### Bugs that repeat become gates

When the same class of bug bites twice, add one of:

- a unit test for pure behavior
- an integration test for a route/data contract
- a static audit for a structural invariant
- a manual smoke checklist entry for live/auth/browser-only behavior

### Tests match risk

- Pure business rules get fast unit tests.
- Routes get auth, validation, and boundary tests.
- Schema/security changes get deny-path tests.
- Critical user journeys get manual smoke coverage until authenticated
  browser automation is practical.
- CI is necessary but not sufficient. Runtime data shape, SSO, storage,
  email, and external services still need preview/prod smoke checks.

## Principle Translation

Classic design acronyms are useful only when translated into this stack:

- SRP: one module has one reason to change. Route files compose; service
  modules do business work; validators validate.
- OCP: extend via new handlers, schemas, and feature folders before
  editing shared infrastructure.
- ISP: client components receive the smallest props they need; services
  expose focused functions, not giant utility objects.
- DIP: feature code depends on local adapters (`lib/email/graph`,
  a scoped data-access wrapper), not directly on vendor SDKs
  scattered through the app.
- Boy Scout Rule: clean the pattern you are touching, but do not turn a
  scoped fix into a stealth refactor.
