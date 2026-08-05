# RUNTIME.md — DOMO MCP

> Runtime facts for this repo. The governance docs reference this file rather
> than naming a stack. Change this file, not the doctrine.

---

## Stack

| Field | Value |
|---|---|
| Runtime | Cloudflare Worker, Streamable HTTP MCP server |
| Package manager | `npm` |
| Language | TypeScript |
| Data store | Cloudflare D1, query log only. Domo is upstream and read-only over its API |
| Auth | Cloudflare Access for SaaS, Entra ID as identity provider |
| Deploy | GitHub Action, `cloudflare/wrangler-action@v3` |
| Secrets live in | `wrangler secret put`. Three: `DOMO_CLIENT_ID`, `DOMO_CLIENT_SECRET`, `DOMO_DATASET_ID` |

Consumers: a Claude Project used by Product Operations, via a custom connector
registered at the Claude organization level.

---

## Verify commands

```
npm run type-check
npx oxlint
npx wrangler deploy --dry-run
```

`type-check` must pass on a clean checkout with no generate or build step first.
There is no code generation in this repo, deliberately.

**Narrower scope, narrower claim.** State exactly what you ran and what you did
not. Never report "all checks passed" on a subset.

---

## Correctness contracts

Four. The last two are unusual in that the contract is prose living inside code,
which makes them likelier than average to get "tidied."

| Contract | Where | Why it is load-bearing | Enforced by |
|---|---|---|---|
| A result exceeding the row cap **errors**, never truncates | `run_sql` validation | A silently truncated result produces a confidently wrong total that nobody downstream can detect | Acceptance criteria 7 and 8; guard test |
| `at_limit` is true only when `numRows` equals the requested `LIMIT` | `run_sql` response mapping | A field that is always one value carries no information. This contract replaced exactly that bug | Acceptance criterion 9, which requires proving both directions |
| The `run_sql` tool description states the three-class delivery exclusion, the `table` alias, the double-quoting rule, and that extended price and cost are computed | `run_sql` tool registration | Tool descriptions are always in the model's context; fetchable reference is only advisory. Shorten this and every product revenue answer silently starts including freight | Guard test asserting the description contains each rule |
| `get_query_reference` returns `reference/DOMO_Reference.md` in full | `get_query_reference` | Truncating or summarizing it for token efficiency silently removes the column dictionary and the unit-of-measure warnings | Acceptance criterion 11, which checks the file's last line is present |

Do not change any of these outside an explicitly scoped task. If you think one is
wrong, say so in your report and let the human decide.

---

## High-risk paths

Serialized-critical. Single agent, no parallel lanes, regardless of the mode in
`docs/operations/HANDOFF.md`.

```
src/domo.ts            token handling, dataset ID, the only Domo egress
src/validation.ts      SELECT-only gate, statement rules, row cap
src/tools.ts           tool registration and descriptions (see contracts above)
wrangler.jsonc         bindings, the reference/*.md Text rule, compatibility date
migrations/            D1 schema for the query log
.github/               CI and deploy
```

`reference/DOMO_Reference.md` is not serialized-critical, since it is expected to
change as the data is better understood. But it directly steers model output, so
every change needs human review. It is not a scratch file.

---

## Architecture boundaries

| Boundary | Rule | Enforced by |
|---|---|---|
| Single Domo egress | Exactly one module holds the token, the dataset ID, and the fetch to `api.domo.com`. Nothing else calls out | Guard test: no `api.domo.com` literal outside that module |
| Validation precedes egress | No code path reaches Domo without passing the full validation gate | Guard test on call ordering |
| The query log is not a tool | No MCP tool reads, lists, or summarizes D1. Operator reads it out of band | Guard test: no D1 binding reference inside tool handlers |
| Results never persist | Query result rows are never written to D1 or anywhere else. Row counts only | Guard test: no `rows` reference in the logging path |
| Secrets via bindings only | No `process.env`, no literals. Env bindings only | oxlint rule plus review |
| Stateless transport | `createMcpHandler`. No Durable Object, no `migrations` block for a DO class | Guard test: no `McpAgent` import; convention for the config |

---

## Schema and migration flow

D1, and only for the query log. Domo's schema is upstream and not ours to change.

```
1. Edit the checked-in SQL in migrations/
2. npx wrangler d1 migrations apply <db> --local   (verify)
3. npx wrangler d1 migrations apply <db> --remote  (human runs this)
4. Commit the migration file in the same PR as any code depending on it
```

Destructive operations are hand-written. There is no generator here, which
removes the generated-noise problem entirely.

---

## Data classification bindings

| Tier | Where it may live in this repo | Who may read it |
|---|---|---|
| Public | Tool names and descriptions, README | Anyone |
| Internal | Column dictionary and query patterns in `reference/DOMO_Reference.md` | Authenticated users |
| Confidential | Everything returned by `run_sql`. Customer names, unit cost, per-line margin. Also the entire D1 query log | Product Ops and IT, via the Access policy |
| Restricted | The three Domo secrets | Operators only |

Note the whole point of this service is to move Confidential data into a chat
context. That is the accepted design, and the compensating control is the Access
policy plus a scoped connector, not the absence of exposure.

### Recorded exceptions

| Rule broken | Where | Why | Compensating control |
|---|---|---|---|
| `DATA_CLASSIFICATION.md` rule 2, Confidential data never appears in logs | D1 `query_log.sql_text` | Queries routinely read `WHERE cusname = '<customer>'`. Redacting literals would destroy the only value the log has, which is seeing what people actually filtered on so Phase 2 tools can be designed from evidence rather than guesswork | Log classified Confidential, operator access only, exposed by no tool. Result rows never logged, counts only. Decision confirmed by the human, not inherited silently |

---

## Monitoring

**Honest gap. Do not treat this table as complete.**

| Field | Value |
|---|---|
| Monitored surface | None yet |
| Monitor / pager | None yet |
| Where monitors are declared | n/a |
| Scheduled jobs + heartbeats | No scheduled jobs |

Per `docs/MONITORING.md`, a service Product Ops depends on with no failure
detection is not finished. Nothing here is scheduled, so there is no silent-stop
risk, but a Domo credential expiry or an Access misconfiguration would surface as
"Claude says the tool is broken" rather than as an alert.

`observability.enabled` is on in `wrangler.jsonc`, which gives logs, not alerts.

Deferred deliberately until the connector is working end to end. Logged in
`docs/operations/BACKLOG.md` so it is a decision rather than an oversight.

---

## Known gotchas

Empty on purpose. Log them the first time they bite.

Two carried in from data profiling that will bite whoever writes a query by hand:

- Domo aliases the dataset as `table`. That is the actual table name, not a
  placeholder, and it is Domo's API convention.
- Domo serializes `fromcache` and `duration` as strings while numerics come back
  as real JSON numbers. Do not add blanket string coercion.
  - The wrangler Text rule glob is `../reference/*.md`, not `reference/*.md`.
  Wrangler resolves static-import rules relative to `src/index.ts`, so the
  repo-root-relative path fails with "No loader is configured for .md". This
  silently couples the glob to `main` staying at src/index.ts.
