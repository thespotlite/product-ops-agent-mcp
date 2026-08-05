# Coding Standards

**This document is mandatory.** Inconsistency is a bug. Every agent
and contributor follows these rules. When touching a file, check
whether the surrounding code follows the patterns. If it doesn't, fix
it in the same change or log the specific files in
`docs/operations/BACKLOG.md`.

The rules pre-date your project. They came out of regressions in a
long-lived production app — each one corresponds to a class of bug
that bit. Read them before re-litigating.

## Principles as code

`docs/ENGINEERING_PRINCIPLES.md` is the doctrine. This file is the
enforcement surface. When a principle is important enough to shape code,
translate it into one of:

- a shared helper (`createApiHandler`, `useMutation`, scoped clients)
- a typed catalog (`permissions`, `statuses`, `constants`)
- a package script or CI gate
- a unit/integration test
- a static audit under `lib/__tests__/`
- a manual smoke checklist item

Do not leave a principle as a slogan if it can be enforced cheaply.

## Backend

- **Route handler:** Authenticated JSON routes use `createApiHandler()`
  from `lib/api/handler.ts`. Cron routes use `createCronHandler()`.
  Do not hand-roll session checks, Zod parsing, or scoped client
  construction in individual route files. Exceptions:
  - Public routes opt out with `auth: "public"`
  - Multipart uploads, file downloads, and signed-URL openers may
    bypass — document the exception inline

- **Route auth default:** Routes are authenticated unless explicitly
  public. A public route is a security decision, not a convenience.
  Public routes must use `auth: "public"` and return sanitized errors.
  Cron routes use `createCronHandler()` so bearer-secret checks are
  centralized and constant-time. If a route cannot use the wrapper,
  document why in the route file.

- **Validation:** All Zod schemas live in `lib/validations/`. Do not
  inline `z.object(...)` or `z.array(...)` in a route file. The
  `inline-zod-audit` test in `lib/__tests__/` enforces. Single-UUID
  params reuse `uuidParamsSchema` from `lib/validations/params.ts`.

- **Query-string booleans:** Use `queryBoolean` from
  `lib/validations/params.ts`. Never `z.coerce.boolean()` — it treats
  the string `"false"` as `true`.

- **Scoped data access:** Authenticated CRUD goes through
  `createScopedDataClient()`. Use `fromOrg()` for reads/updates/
  deletes and `insertOrg()` for inserts. Do not call `.insert()` on
  a `fromOrg()` result — `insertOrg` exists so org ownership is
  attached centrally. Public submission routes and cron/service
  routes may use the admin/service-role client with an inline
  `// allow-admin-scope: <reason>` comment.

- **Response helpers:** All routes return via `successResponse()`,
  `errorResponse()`, `paginatedResponse()`, or `cachedResponse()`
  from `lib/api/response.ts`. Do not construct raw `Response.json()`.

- **Error responses:** Never leak raw error messages from the datastore,
  Graph, or upstream services to the client. Log the detail with
  `console.error` (or the logger), return a generic user-safe
  message via `errorResponse()`.

- **Background work durability:** Classify every background side effect.
  Ephemeral telemetry may use `.then(..., (err) => log(err))`. Audit
  logs, notifications, financial records, and user-visible downstream
  effects need persisted failure telemetry or a durable outbox. Never
  leave a background promise unhandled. Never tell the user "success"
  if required downstream state was neither committed nor durably queued.

- **Route params typing:** Use the async params pattern:
  `{ params: Promise<{ id: string }> }`. The synchronous shape is
  the old API.

- **Constants:** All magic strings, color maps, model IDs, status
  lists, and repeated values live in `lib/constants.ts` (or a
  per-feature `features/<name>/constants.ts`). If a value appears in
  2+ files, it belongs in constants.

- **Server-owned aggregates:** Any KPI, count, money value, status
  rollup, or operational total shown in two or more surfaces comes from
  one server-side projection. Clients render server values; they do not
  independently `.reduce()` raw rows in multiple places. If a new app
  has shared KPIs, add a static audit like ITCC's
  `no-client-side-aggregation` before the second surface ships.

- **Multi-write atomicity:** When a logical operation issues two or
  more writes that must succeed or fail together (consume a token +
  rotate it, persist a chat message + start the AI stream), use a
  Postgres function invoked via `scoped.rpc()` rather than a sequence
  of awaits. Half-applied state is the worst kind of bug to debug.

- **Rate limiting:** Every public, auth-adjacent, AI, upload,
  expensive, or abuse-prone route needs an explicit rate-limit
  decision. Durable DB-backed limits are preferred in production because
  serverless instances do not share memory. In-memory limits are
  acceptable only as temporary/low-risk stopgaps with a documented
  follow-up. Decide fail-open vs fail-closed intentionally and leave
  that reason in code.

- **No silent fallbacks in service modules:** A service that fetches
  from the datastore or any upstream must distinguish "no data" from
  "fetch failed" at the type level. Use a discriminated envelope
  (`{ ok: true; data } | { ok: false; reason: string }`) or a sibling
  discriminator field. `catch { return [] }` and `catch { return null }`
  in service modules hide real failures. If the pattern appears twice,
  add a `no-silent-fallbacks` static audit.

- **AI-generated text carries provenance:** Any string field whose
  value is LLM-generated must carry a `provenance` discriminator on
  its type. Prevents downstream exporters from rendering AI output as
  human-confirmed copy.

- **Env access:** Read environment variables through `@/lib/env/server`
  or `@/lib/env/public`. The ESLint rule warns on ad-hoc
  `process.env` access. The validators with `superRefine` catch
  misconfig at boot — that's where pair-wise rules go (if A is set,
  B must be set too).

## Frontend

- **`useFetch` four-branch contract:** Every component using `useFetch`
  surfaces all four user-facing branches:
  - **loading** inside the owning panel, never a full-page spinner
  - **error** via `<SectionError>` with a retry that calls `refetch()`.
    Never `return null` on a truthy error.
  - **empty** cause-aware (the "nothing here yet" UI is not the same
    component as the "we couldn't load it" UI)
  - **partial** when a panel reads multiple sources and some succeed
    while others fail (surface the degradation explicitly)

- **Mutation orchestration:** Client mutations use `useMutation` from
  `lib/hooks/use-mutation.ts`. The hook requires an `invalidates`
  field (single domain key, array of keys, or explicit `null` to opt
  out) so cache invalidation can't be silently skipped.

- **Cross-surface refresh:** Mutations invalidate the affected
  domain through the `invalidates` field. Wire your real cache layer
  (SWR / React Query / store) to `onInvalidate()` once at the app
  root.

- **Long-form dialog discard guard:** Stateful dialogs that hold
  substantial form state intercept close attempts (Esc, backdrop
  click, the X button) and confirm before discarding edits. Always-
  mounted Radix portals with `forceMount` can block pointer events
  when visually closed — don't use `forceMount` for nav.

- **Shared components:** Use existing shared components
  (`SectionError`, etc.) before creating one-offs. If a pattern
  exists in `components/shared/`, use it.

- **Map/Set iteration:** Use `.forEach()`, not `for...of` — the
  tsconfig is intentionally without `downlevelIteration`.

- **No privileged imports in client code:** Server-only modules — the
  admin/service-role datastore client, server env, the raw database client —
  must never be importable from client code. Enforce with a static audit, not a
  convention. See `RUNTIME.md` § Architecture boundaries.

## Schema + migrations

Full workflow in `RUNTIME.md` § Schema and migration flow. The non-negotiables,
whatever the tooling:

- One declared source of truth for the database shape. A schema change that does
  not appear there did not happen.
- Generated migration SQL is reviewed before commit, never committed blind.
  Generators emit security-relevant and destructive statements that must be
  stripped or rewritten.
- Destructive operations — renames, drops, type narrows — are hand-written.
  Generator auto-emit for these is commonly drop-and-recreate, which loses data.
- A drift check runs in CI and must be clean before merge.

## Static audit catalog

Structural invariants worth enforcing as tests rather than trusting to review.
The catalog is per repo; record it in `RUNTIME.md` § Architecture boundaries with
the enforcing mechanism named.

The pattern is what transfers: when a class of bug appears twice, stop fixing
instances and write the guard. Each guard carries a doc-block naming the failure
mode it catches, so the next person understands why it exists before deciding to
delete it.

Guards that tend to earn their place in any repo:

- Server-only modules unreachable from client code
- Validation schemas centralized rather than inlined at call sites
- Privileged data-access clients not used where a scoped client should be
- Generated migrations not silently stripping access-control statements
- Monitored surfaces not normalized into uniformity with everything else

## When a rule needs an exception

Two ways:

1. **Inline allowlist marker** — for audits that support one
   (`// allow-inline-zod: <reason>`, `// allow-admin-scope: <reason>`).
   Use sparingly.

2. **Lift the rule** — if you're reaching for the marker more than
   once per audit per quarter, the rule is wrong. Update this file,
   update the audit, and document the change in `DESIGN_DECISIONS.md`.

Do not silently delete an audit because it fails on your code.
