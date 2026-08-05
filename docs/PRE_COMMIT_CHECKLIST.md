# Pre-Commit Checklist

The gate before merge. Commands are per repo — run the set in
`RUNTIME.md` § Verify commands. This file is the shape of the gate, not the
command list.

Copy the relevant sections into the PR description rather than asserting "checks
pass."

## Always

- [ ] `RUNTIME.md` is filled in, no `__PLACEHOLDER__` values remain
- [ ] Full verify set from `RUNTIME.md` ran clean
- [ ] Scope matches what was approved. Nothing unrelated was fixed along the way
- [ ] No new dependency added without human approval
- [ ] No parallel pattern introduced where an existing one should have been
      extended
- [ ] Affected flow smoke tested by a human. **A passing build is not a passing
      smoke test for anything interactive**

## If a correctness contract was touched

From `RUNTIME.md` § Correctness contracts.

- [ ] The change was explicitly scoped to that contract, not incidental
- [ ] The failure branch was **deliberately exercised**, not assumed
- [ ] The enforcing test still fails when the contract is broken. Break it on
      purpose once and confirm
- [ ] Observed result pasted into the PR, not described

## If a high-risk path was touched

From `RUNTIME.md` § High-risk paths.

- [ ] Session ran `serialized-critical` — single agent, no parallel lanes
- [ ] Structural audits and guard tests pass
- [ ] If a guard rule itself changed, the human approved it. Weakening a guard is
      a decision, not a refactor

## If schema was touched

- [ ] Change was approved before implementation
- [ ] Declared source of truth updated, not just the generated output
- [ ] Generated migration reviewed line by line
- [ ] Access-control statements not silently stripped by the generator
- [ ] Destructive operations hand-written, not generator-emitted
- [ ] Applied locally and the drift check is clean
- [ ] Source of truth, migration, and journal in the same PR

## If monitoring or a scheduled job was touched

- [ ] Healthy path observed returning what the monitor expects
- [ ] Failure path deliberately exercised
- [ ] New scheduled job: heartbeat allowed to lapse once past interval plus
      grace, and the incident observed firing
- [ ] Heartbeat URLs came from the secret store, appear in no committed literal,
      no log line, no API response
- [ ] Monitor declared in the source of truth from `RUNTIME.md`, not a vendor UI

## If data handling changed

- [ ] Tier confirmed against `docs/DATA_CLASSIFICATION.md`
- [ ] Nothing Confidential entered a log
- [ ] Nothing Restricted entered the codebase, including as a "obviously fake"
      placeholder
- [ ] Any deliberate exception recorded in `RUNTIME.md` § Data classification
      bindings, with its compensating control
- [ ] Public-facing errors carry no upstream detail

## Before ending the session

- [ ] `docs/operations/HANDOFF.md` updated: state, next step, context
- [ ] `docs/operations/CHANGELOG.md` updated if user-visible behavior shipped
- [ ] New settled decision recorded in `docs/DESIGN_DECISIONS.md`
- [ ] Anything that cost real time recorded in `docs/LESSONS_LEARNED.md` if it
      generalizes, or `RUNTIME.md` § Known gotchas if it does not

## Honesty clause

If you ran a subset, say which. If you skipped something, say so and why.
"All checks passed" when you ran the linter is the failure this checklist exists
to prevent.
