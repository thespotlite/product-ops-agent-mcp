# Codex Task: DOMO MCP Server

## Objective

Convert this repo from the skills MCP server into a DOMO query MCP server that Claude
can connect to as a custom connector.

The Domo query path is written fresh here. There is no existing code to reuse: the
current ChatGPT proxy worker is unversioned and is being deleted after cutover rather
than migrated.

**In scope:** repo conversion, Domo auth and query path, MCP transport, request
validation, row cap, logging, three tools.

**Out of scope:** structured domain tools such as revenue, freight, or customer
helpers. Those are specced separately after two to three weeks of query log data. Do
not build them, do not scaffold for them.

## Target repository

A **new, empty repo**. Scaffold with `npm create cloudflare`. Worker name `domo-mcp`.

Do not convert the `motz-kb-mcp-server` repo. It was evaluated and rejected: it is built
on the deprecated `McpAgent` class with a Durable Object that would need a
`deleted_classes` migration to remove, and its GitHub Action auto-deploys on push to a
worker that is still live. The reusable surface is four config files, which is not worth
that.

Copy `DOMO_Reference.md` into `reference/DOMO_Reference.md`. It is served by the
`get_query_reference` tool and is a first class part of this repo, not documentation.

Copy these across from `motz-kb-mcp-server` unchanged: `tsconfig.json`,
`.oxlintrc.json`, `.oxfmtrc.json`, `.gitignore`.

Copy `.github/workflows/deploy.yml` and adapt it: drop the `node generate-skills.mjs`
step, keep the `cloudflare/wrangler-action@v3` pattern and the `CLOUDFLARE_API_TOKEN`
secret reference.

Do not copy: `src/`, `generate-skills.mjs`, `src/md.d.ts`, `skills/`,
`worker-configuration.d.ts`, or `wrangler.jsonc`.

Keep `zod` as a dependency for tool input schemas. Keep `oxlint`, `oxfmt`, `typescript`,
`wrangler` at the versions pinned in the KB repo's `package.json`.

### Wrangler config requirements

Written fresh, not copied. Specifically:

- No `durable_objects` block and no `migrations` block. The stateless transport does not
  need either, and starting clean avoids the DO deletion problem entirely.
- A `rules` block with one entry: `type: "Text"`, glob `reference/*.md`. This bundles the
  query reference for `get_query_reference`. Scope it to `reference/` only. The KB repo's
  `**/*.md` glob is too broad and would pull in the README.
- A `src/md.d.ts` style declaration so the `.md` import type checks.
- `compatibility_date` set to a current date, not the KB repo's `2025-03-10`.
- `nodejs_compat` in `compatibility_flags`.
- `observability.enabled` true and `upload_source_maps` true, matching the KB repo.
- One D1 binding for the query log, `database_id` marked `TODO`.

## Governance

This repo inherits the governance layer from `internal-starter-template-v9`, not its
runtime. Copy in `CLAUDE.md`, `CODEX.md`, `AGENTS.md`, `docs/ENGINEERING_PRINCIPLES.md`,
`docs/CODING_STANDARDS.md`, `docs/DATA_CLASSIFICATION.md`,
`docs/PRE_COMMIT_CHECKLIST.md`, `docs/operations/`, `docs/templates/SMOKE_TEST_MATRIX.md`,
and the `.github` templates. Do not copy anything Next.js, Vercel, Supabase, Drizzle,
Sentry, React, or Tailwind related.

Three adaptations are required before those docs are accurate here:

1. `CODEX.md` § Required checks currently lists `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, `pnpm build`, `pnpm check:imports`. None apply. Replace with
   `npm run type-check`, `oxlint`, and `wrangler deploy --dry-run`.
2. `CODEX.md` § Schema changes describes Drizzle generate/migrate against Supabase with
   RLS. Replace with the D1 migration flow for the query log table.
3. `AGENTS.md` rule 6 protects `app/api/health/route.ts` as a fleet contract. That file
   does not exist here. Retarget the rule to the row cap and `at_limit` semantics in this
   server, which are a correctness contract for the same reason: silently changing them
   produces wrong answers that nobody can see. Do not alter either outside an explicitly
   scoped task.

Populate `docs/operations/HANDOFF.md` with the execution mode before editing. Per
`AGENTS.md`, absent a declared mode, assume sequential and confirm first.

Report per `CODEX.md` § After every implementation pass, and tag findings with the
`confirmed` / `disputed` / `manual-only` / `noise` labels from `AGENTS.md` § Findings
labels.

## Prerequisites held by the human

Do not attempt to obtain these. Reference them as secrets and note them as blockers.

- `DOMO_CLIENT_ID`
- `DOMO_CLIENT_SECRET`
- `DOMO_DATASET_ID` for Product Sales History

## Domo query path

Known from a working production call, treat as given:

```
POST https://api.domo.com/v1/datasets/query/execute/{DOMO_DATASET_ID}
Authorization: Bearer {access_token}
Content-Type: application/json

{"sql": "SELECT ... FROM table LIMIT 1"}
```

The dataset is always aliased `table` in this API. That is Domo's convention, not a
placeholder, and it is the reason the query rules insist on it.

Response shape, captured verbatim from a live production call. This is the real envelope,
not a summary of it:

```json
{
  "datasource": "<dataset uuid>",
  "device": "ad3-prod9-42",
  "columns": ["invdate", "class", "price", "qty", "ext"],
  "metadata": [
    { "type": "DATE",   "origType": null, "dataSourceId": "<uuid>", "maxLength": -1,
      "minLength": -1, "largestDate": null, "smallestDate": null, "largestValue": null,
      "smallestValue": null, "aggregated": false, "analytic": false },
    { "type": "STRING", "...": "one object per column, same shape" },
    { "type": "DOUBLE", "...": "..." }
  ],
  "fromcache": "false",
  "numColumns": 5,
  "rows": [["2021-10-08", "ENVIRO", 0.199, 630000, 125370]],
  "numRows": 1,
  "duration": "76"
}
```

Notes that follow from this and are not optional:

- **Numerics arrive as JSON numbers, not strings.** `0.199` and `630000`, not `"0.199"`.
  Do not add string coercion or parsing. Pass them through.
- **`metadata[]` is positionally aligned with `columns[]`** and carries a `type` per
  column, observed values `DATE`, `STRING`, `DOUBLE`. This is the schema source for
  `describe_schema`; see that tool.
- **`fromcache` and `duration` are strings**, not a boolean and a number. Domo
  serializes them that way. Do not assume otherwise if you surface them.
- **`numRows` and `numColumns` are authoritative counts.** Use `numRows` for
  `row_count`; do not compute `rows.length` yourself.
- `device` is a Domo internal node identifier with no meaning here. Drop it.
- `datasource` echoes the dataset UUID on every response. Harmless to pass through,
  useless without credentials.

**Read Domo's current developer documentation for the OAuth client credentials flow
rather than inferring it.** Confirm the token endpoint, the required scope, and the
token lifetime from the docs. Cache the token in memory for the isolate and refresh on
expiry or on a 401. Do not request a fresh token per query.

Report in your summary which auth flow the docs specify and what you implemented.

## Transport

Single route: `POST /mcp`, Streamable HTTP, via `createMcpHandler`.

Do not use `McpAgent`. It is the deprecated path for new servers, retained only for SSE
legacy clients. No session state is required; every request is independent.

## Auth

Cloudflare Access in front of `/mcp`, configured as Access for SaaS with the existing
Entra ID tenant as identity provider.

Claude custom connectors treat OAuth as the mainline auth path. Request header auth
exists but is still in beta rollout, so do not build on it.

The worker reads the authenticated user's email from the Access JWT and writes it to
every log row. Do not implement your own auth check; Access rejects before the worker
runs.

## Request validation

Applied to the `sql` argument of `run_sql` before anything reaches Domo. On rejection,
return a structured MCP error with a message the model can act on.

1. After trimming and collapsing whitespace, the statement must begin with `SELECT` or
   `WITH`.
2. Reject any `;` anywhere in the string, including a trailing one.
3. Reject on case insensitive word boundary match:
   `INSERT UPDATE DELETE DROP ALTER CREATE TRUNCATE GRANT REVOKE REPLACE MERGE INTO`
4. Reject strings longer than 8000 characters.
5. Reject strings containing `--` or `/*`.

## Row cap and truncation detection

Hard ceiling of 5000 rows. Domo's own limit is around one million, so this one binds
first and is therefore the meaningful constraint.

The goal is that a truncated result can never be mistaken for a complete one. Silent
truncation produces confidently wrong totals with no signal to the model or the user,
and that is the single worst failure mode this server can have.

Implement in two parts.

**Part 1, reject unbounded queries.** Every `run_sql` call must carry an explicit
trailing `LIMIT n` with `n <= 5000`. If `LIMIT` is absent, or `n > 5000`, reject before
calling Domo:

> Query must end with an explicit LIMIT of 5000 or fewer. For a total across more rows
> than that, aggregate server side with SUM and GROUP BY rather than returning rows.

Do not silently inject or rewrite the model's `LIMIT`. Rewriting user SQL is how you
end up with a result nobody can reason about.

**Part 2, flag boundary results.** After the call, compare `numRows` against the `n`
the query requested. If they are equal, the result sits exactly at its own limit and may
be incomplete. Return `at_limit: true`.

This replaces the `truncated: false` field from an earlier draft of this spec, which was
always false by construction and therefore carried no information. `at_limit` is the
useful signal: it is the difference between "here are all 300 matching rows" and "here
are the first 500 of an unknown number."

## Logging

Every tool invocation goes to a D1 table. D1 rather than Analytics Engine because this
log gets read and grouped in a few weeks to author the next tool spec.

Columns: `ts`, `user_email` from the Access JWT, `tool_name`, `sql_text`, `row_count`,
`duration_ms`, `error` nullable, `rejected_by` nullable indicating which validation
rule fired.

Log rejected and failed calls, not just successes. What people tried and could not do
is the most useful signal in the table.

### Data classification of the query log

`sql_text` will routinely contain customer names in `WHERE` clauses, for example
`WHERE cusname = 'XGrass'`. Under `docs/DATA_CLASSIFICATION.md` names are Confidential,
and rule 2 states Confidential data never appears in logs. This log knowingly breaks that
rule, because redacting literals would destroy the only thing the log is for: seeing what
people actually filtered on so Phase 2 tools can be designed from evidence.

Handle it as a recorded exception, not an oversight:

- Classify the D1 query log as **Confidential**, operator access only.
- Do not expose it through any MCP tool. It is read out of band by the operator.
- Never log the `rows` payload or any query result. Row counts only. The result set
  contains unit cost and margin across the full customer base and has no business
  sitting in a second store.
- Add a row to the tier table in `docs/DATA_CLASSIFICATION.md` naming this log, its tier,
  where it lives, and who may read it, per that document's own instruction to update the
  table when a new data class is added.

Flag this in your completion report as a `manual-only` finding so the human confirms the
classification decision rather than inheriting it silently.

## Tools

### `run_sql`

- Input: `sql` string, required
- Returns `{ columns, rows, row_count, at_limit, column_types }`
- `row_count` comes from Domo's `numRows`
- `at_limit` is true when `numRows` equals the `LIMIT` the query asked for; see the row
  cap section
- `column_types` is `metadata[].type` flattened to a plain array aligned with `columns`,
  so the model can tell a `DATE` from a `STRING` without a second call
- Drop `device`, `metadata` in raw form, `fromcache`, `duration`, and `numColumns` from
  what the model sees. Log `duration` and `fromcache` instead.

Tool description must state: the table is always `table`; columns containing a space or
slash require double quotes; extended price and extended cost are not stored columns
and must be computed as `price * qty` and `cost * qty`; delivery lines
(`class IN ('DEL-LAND','DEL-SPOR')`) are excluded from product revenue and are the sole
population for freight analysis; call `get_query_reference` before composing any query
involving columns or filters not covered above.

These rules belong in the description because tool descriptions are always in the
model's context. Anything stated only in fetchable reference material is advisory.

### `data_boundary`

- No input
- Returns `MIN(invdate)`, `MAX(invdate)`, `MIN(date)`, `MAX(date)`, total row count,
  and the count of rows where `invdate IS NULL`
- Single Domo call, not five

### `describe_schema`

- No input
- Returns the live column list paired with types for the dataset
- Implement as a single `SELECT * FROM table LIMIT 1` and read `columns[]` zipped with
  `metadata[].type`. Domo returns full column metadata on any query, so no separate
  schema endpoint is needed. Discard the data row.
- Purpose: schema drift in Domo cannot silently invalidate the query reference

### `get_query_reference`

- No input
- Returns the full contents of `reference/DOMO_Reference.md` as text
- Bundled at build time via a wrangler `rules` entry of `type: "Text"` with glob
  `reference/*.md`, imported as a string. This is the one pattern worth lifting from the
  KB repo, though it applies to a single file rather than a generated registry, so no
  build script is needed.
- Purpose: the query reference version controls alongside the tools it describes.
  Schema changes and documentation changes ship in the same commit, and there is no
  uploaded file anywhere to drift out of sync.

Note this reverses the earlier instruction to omit the `rules` block from the wrangler
config. Include it, scoped to `reference/*.md` only, not `**/*.md`.

## Error surfacing

Domo errors must reach the model as readable MCP errors, never swallowed into a 500. A
missing column error in particular has to arrive intact so the model can self correct on
the next call.

## Not in this lane

These need dashboard access or an authenticated CLI session. Do not attempt them and do
not block on them.

- `wrangler d1 create` and binding the resulting database ID
- `wrangler secret put` for the three Domo secrets
- Creating the Cloudflare Access application and Entra identity provider
- Adding the `CLOUDFLARE_API_TOKEN` secret to the new repo
- Registering the connector in Claude

Deployment itself is not a blocker once the API token secret is in place, since the
GitHub Action handles it. But do not push to `main` until the D1 binding is real. A
config with `TODO: database_id` will fail the deploy, which is the correct outcome.

Deliver code, wrangler config with the binding marked `TODO`, and the D1 migration as a
checked in SQL file. Then stop and report exactly what is needed to deploy.

## Acceptance criteria

A passing build is not a passing test. Verify each item against the deployed worker,
not against types.

1. `npm run type-check` passes on a clean checkout with no build or generate step first.
   The KB repo could not do this, and the DOMO server has no reason to inherit that.
2. `POST /mcp` completes an MCP initialize handshake and lists exactly four tools.
   Confirm the handler is `createMcpHandler` and that no Durable Object is declared.
3. An unauthenticated request to `/mcp` is rejected by Access before worker code runs.
4. `run_sql` with `SELECT MAX(invdate) AS latest FROM table LIMIT 1` returns a row.
5. `run_sql` with `DROP TABLE x` is rejected by rule 3 and logged with `rejected_by`
   populated.
6. `run_sql` with `SELECT 1; SELECT 2` is rejected by rule 2.
7. `run_sql` with a query carrying no `LIMIT` is rejected before any Domo call is made.
8. `run_sql` with `LIMIT 6000` is rejected.
9. A query whose result exactly fills its own `LIMIT` returns `at_limit: true`, and one
   that returns fewer rows than its `LIMIT` returns `at_limit: false`. Verify both
   directions; a field that is always one value is the bug this replaced.
10. `data_boundary` returns a non-null `MAX(invdate)`.
11. `get_query_reference` returns the full text of `reference/DOMO_Reference.md`, not a
   truncated or summarized version. Confirm the last line of the file is present in the
   output.
12. `describe_schema` returns a non-empty column list. Print it verbatim in your summary.
    Do not attempt to reconcile it against `reference/DOMO_Reference.md`; that comparison
    is done by hand and any discrepancy is a data question, not a code question.
13. Two consecutive `run_sql` calls issue one Domo token request, not two.
14. The D1 log contains one row per attempt above, successes and rejections, each with a
    populated `user_email`.

## Cutover sequence

Steps 2 and 3 are human actions and 3 requires the Claude org Owner.

1. Deploy `domo-mcp`. Note the resulting `workers.dev` hostname.
2. Cloudflare Access application over `/mcp`, Entra as IdP, policy scoped to IT plus
   Product Ops.
3. Owner adds the custom connector at Claude organization level. Members then connect
   individually.
4. Verify all acceptance criteria from inside a Claude conversation.
5. Data profiling pass. Replace the unverified figures in the reference document with
   confirmed numbers.
6. Write Project instructions against verified ground truth.
7. Onboard Product Ops.
8. Retire the ChatGPT GPT.
9. Delete the `domo-chatgpt-proxy` worker.

Nothing before step 8 removes the old worker. It stays live for the GPT until Product
Ops has actually moved.
