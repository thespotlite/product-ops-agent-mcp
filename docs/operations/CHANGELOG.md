# Changelog

Per-slice ship log. Append-only, newest first. Updated when user-visible
behavior ships, per `CLAUDE.md` § Closeout standard.

Not a git log. Git already records every commit. This records what changed for
the people using the thing.

## Format

```
## YYYY-MM-DD — <slice name>

**Shipped:** what a user can now do that they could not before.
**Changed:** behavior that existed and is now different.
**Fixed:** what was broken.
**Internal:** structural work with no user-visible effect. Optional.
**Rollback:** how to undo it, if not simply reverting the commit.
```

## Unreleased

## 2026-08-05 — DOMO MCP production foundation

**Shipped:** Deployed the four-tool DOMO MCP server at
`domo-mcp.abush.workers.dev` behind Cloudflare Access with Entra ID, backed by
the live Domo dataset and a migrated D1 query log with real user attribution.

**Verified:** Streamable HTTP initialization succeeds; `tools/list` returns
exactly four tools; `run_sql` returns live rows with `at_limit` and
`column_types`; `data_boundary` returned invoice dates 2021-01-04 through
2026-08-05, record dates 2020-10-22 through 2026-08-04, 18,648 total rows, and
zero null invoice dates; `get_query_reference` returned all 23,683 bytes.
Unauthenticated requests are rejected (401 before Access, 302 login redirect
after Access).

**Changed:** GitHub Actions now deploys on pushes to `main`; the D1 database,
Domo secrets, Zero Trust organization, Entra identity provider, Access policy,
and production Access audience are configured.

**Known limitation:** The service is deployed but is not yet reachable by any
MCP client because browser-mode Access returns an HTML login redirect to
non-browser clients.

**Rollback:** Revert the DOMO MCP deployment commits and redeploy; do not remove
the legacy `domo-chatgpt-proxy`, which remains the active Product Operations
path until cutover.
