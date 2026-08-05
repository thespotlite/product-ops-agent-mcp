# Backlog

Open work items, in priority order. Not a wishlist — items here are
real things we plan to ship.

## In flight

Items currently being worked on. Should match `HANDOFF.md`'s "Remaining
work" section.

- _(nothing yet)_

## Next up

The 3–5 items expected to ship in the next session or two.

- **Verify error-path query logging during the auth pass** (priority: high) — D1 contains only successful calls; two known failures have no rows, and `log.ts` intentionally catches D1 failures, so a broken error path can be silent.
- **Reconcile npm audit findings during the auth pass** (priority: med) — Eight moderate and one high finding appear dev-only or unreachable on Workers; `npm audit fix --force` proposes an unacceptable Wrangler downgrade from 4.119.0 to 4.35.0.
- **Remove orphaned Zero Trust configuration** (priority: low) — Delete the `domo-chatgpt-proxy` Access application and its one-time-PIN identity provider entry.

## Later

Items we've agreed to do but aren't queued yet. Triage every couple
of weeks — items that sit here for 3+ months either get promoted or
deleted.

- **Reduce aggregate `at_limit` noise** (priority: low) — Single-row aggregate queries always satisfy `LIMIT 1`, making the technically correct flag practically uninformative; consider suppressing it for that shape.
- **Add monitoring and failure detection** (priority: med) — `domo-mcp` currently has no alerting; this was deliberately deferred and is documented in `RUNTIME.md` § Monitoring.
- **Revisit the workers.dev hostname** (priority: low) — Cloudflare documents workers.dev for non-business-critical use; accept this deviation until a custom domain is warranted.

## Tracked drift

Files that don't follow the current pattern but aren't worth a
dedicated fix yet. Logged here so the inconsistency is visible.

- _(nothing yet)_

## Ideas

Wishlist territory. Move to "Later" when committed; delete otherwise.

- _(nothing yet)_

## Format

```
- **Title** (priority: high | med | low)
  - Why: one line
  - Where: file path or surface
  - Estimate: rough
```
