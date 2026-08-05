## What changed

<!-- One line per file or logical change. -->

## Why

<!-- The problem. Link the issue, PRD, or APPROVED_FIX_LIST entry. -->

## Scope

- [ ] Matches what was approved
- [ ] No unrelated fixes bundled in
- [ ] No new dependencies, or human approval linked below

## Verification

Commands from `RUNTIME.md` § Verify commands. **Paste what you ran, not "checks
pass."**

```
```

- [ ] Affected flow smoke tested by a human

## Contracts and high-risk paths

- [ ] No correctness contract from `RUNTIME.md` was touched
- [ ] If one was: failure branch deliberately exercised, result pasted above
- [ ] No high-risk path touched, or session ran `serialized-critical`

## Schema

- [ ] Not touched
- [ ] If touched: approved, generated SQL reviewed, destructive ops hand-written,
      drift check clean

## Monitoring

- [ ] Not touched
- [ ] If touched: failure path exercised and the alert observed firing. A
      successful deploy is not evidence

## Data handling

- [ ] Tier confirmed against `docs/DATA_CLASSIFICATION.md`
- [ ] Nothing Confidential in logs, nothing Restricted in code
- [ ] Any deliberate exception recorded in `RUNTIME.md`

## Rollback

<!-- How to undo this, if not a plain revert. -->

## Observed issues

<!-- Unrelated problems noticed and deliberately not fixed. Per CODEX.md. -->
