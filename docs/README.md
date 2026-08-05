# docs/

Governance and doctrine. Portable across repos. Everything runtime-specific
lives in `RUNTIME.md` at the root.

## Read in this order

1. [`../RUNTIME.md`](../RUNTIME.md) — this repo's stack, commands, high-risk
   paths, correctness contracts. **Fill in first; nothing else works until you
   do.**
2. [`../CLAUDE.md`](../CLAUDE.md) — repo law, architecture boundaries, review
   standard
3. [`../CODEX.md`](../CODEX.md) — implementer role and operating rules
4. [`../AGENTS.md`](../AGENTS.md) — how agents coordinate, execution modes,
   findings labels
5. [`ENGINEERING_PRINCIPLES.md`](./ENGINEERING_PRINCIPLES.md) — doctrine on
   duplication, security, testing
6. [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — concrete conventions

## Reference

- [`DESIGN_DECISIONS.md`](./DESIGN_DECISIONS.md) — settled decisions, not
  re-litigated
- [`DATA_CLASSIFICATION.md`](./DATA_CLASSIFICATION.md) — four tiers and their
  handling rules
- [`MONITORING.md`](./MONITORING.md) — failure detection doctrine
- [`LESSONS_LEARNED.md`](./LESSONS_LEARNED.md) — cross-project regressions
- [`PRE_COMMIT_CHECKLIST.md`](./PRE_COMMIT_CHECKLIST.md) — the gate before merge

## Operations

Living state, not doctrine.

- [`operations/HANDOFF.md`](./operations/HANDOFF.md) — current state, active
  lanes, next step
- [`operations/BACKLOG.md`](./operations/BACKLOG.md) — what is queued
- [`operations/APPROVED_FIX_LIST.md`](./operations/APPROVED_FIX_LIST.md) — audit
  follow-ups cleared for implementation
- [`operations/CHANGELOG.md`](./operations/CHANGELOG.md) — per-slice ship log

## Templates

- [`templates/PRD.md`](./templates/PRD.md)
- [`templates/SMOKE_TEST_MATRIX.md`](./templates/SMOKE_TEST_MATRIX.md)
- [`templates/STATE_MACHINE.md`](./templates/STATE_MACHINE.md)
