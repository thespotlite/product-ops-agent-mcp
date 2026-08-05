# Approved Fix List

The single source of truth for audit follow-ups that have been
triaged and approved for implementation. Items here are scoped,
specific, and ready for an agent to pick up.

Distinct from `BACKLOG.md` — that's general planning. This file is
specifically for audit / review output that's been processed.

## Release target

- **Version:**
- **Date:**

## Confirmed

Items verified to be real, with evidence and an approved fix.

1. **Issue title**
   - Evidence: file:line or repro steps
   - Impact: who's affected, how
   - Approved fix: one-line description
   - Owner: agent or human
   - Status: not started | in progress | done

## Disputed

Findings where there's disagreement on whether they're real or how
to fix them. Resolved by human decision.

1. **Issue title**
   - Why disputed:
   - Decision owner:
   - Final decision:

## Manual-only checks

Items that can't be verified by an AI agent — require a human to
test against the real environment.

1. **Check title**
   - Steps:
   - Expected result:
   - Result:

## Noise / rejected findings

Things flagged in audits that aren't real issues. Recording why
they're rejected so they don't keep getting re-raised.

1. **Finding title**
   - Reason rejected:

## Post-release backlog

Items that will be addressed but aren't blocking this release.

1. **Item**
   - Why not now:
   - When:
