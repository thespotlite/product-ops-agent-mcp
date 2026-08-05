# Internal Governance Template v1

Repo governance and AI-agent operating rules, with no runtime attached.

Derived from the governance layer of `internal-starter-template-v9`. That
template is a Next.js application starter whose docs happened to contain the
standards; this one is the standards on their own, so they can be dropped into a
Cloudflare Worker, a Node service, a Python job, or a Next.js app without
carrying a stack that does not apply.

**No code. No dependencies. No `package.json`.** Add this on top of whatever
scaffold the project actually needs.

---

## How it works

Every doc here references `RUNTIME.md` instead of naming a framework, package
manager, or file path. `RUNTIME.md` is the only file you edit per repo.

That is the one structural change from v9, where the stack was spread across
eight documents. Naming pnpm in `CODEX.md`, Supabase in `DATA_CLASSIFICATION.md`,
and `app/api/health/route.ts` in `AGENTS.md` meant reusing the doctrine required
finding and rewriting all of it, which in practice means it either does not get
reused or gets reused with lies in it.

---

## Adoption

1. Copy these files into the repo.
2. **Fill in `RUNTIME.md` completely.** Every `__PLACEHOLDER__` gets a real
   value or the section gets deleted. Nothing else here is usable until this is
   done.
3. Replace `__APP_NAME__` and `__GITHUB_OWNER__` in `CLAUDE.md`, `RUNTIME.md`,
   and `.github/CODEOWNERS`.
4. Set the `package-ecosystem` in `.github/dependabot.yml`, or delete it if the
   repo has no dependencies.
5. Declare an execution mode in `docs/operations/HANDOFF.md` before any agent
   edits anything.
6. Leave `DESIGN_DECISIONS.md`, `LESSONS_LEARNED.md`, and `RUNTIME.md` § Known
   gotchas empty. They earn entries.

The two hardest sections in `RUNTIME.md` are **Correctness contracts** and
**Architecture boundaries**. They are also the ones that pay for themselves.
Filling them in badly is worse than leaving them empty, because a boundary
listed with no enforcement mechanism implies a guarantee that does not exist.

---

## Contents

```
README.md                 this file
RUNTIME.md                per-repo runtime facts — fill in first
CLAUDE.md                 planner / architect / reviewer role, repo law
CODEX.md                  implementer role, operating rules, reporting format
AGENTS.md                 multi-agent coordination, execution modes, findings labels

docs/
  README.md               docs index and reading order
  ENGINEERING_PRINCIPLES.md   duplication, security, testing doctrine
  CODING_STANDARDS.md         concrete conventions and guard-test patterns
  DATA_CLASSIFICATION.md      four tiers and handling rules
  MONITORING.md               failure-detection doctrine
  PRE_COMMIT_CHECKLIST.md     the merge gate
  DESIGN_DECISIONS.md         settled decisions log (empty)
  LESSONS_LEARNED.md          cross-project regressions (two standing entries)
  operations/
    HANDOFF.md              current state, active lanes, next step
    BACKLOG.md              queued work
    APPROVED_FIX_LIST.md    audit follow-ups cleared to implement
    CHANGELOG.md            per-slice ship log
  templates/
    PRD.md
    SMOKE_TEST_MATRIX.md
    STATE_MACHINE.md

.github/
  PULL_REQUEST_TEMPLATE.md
  CODEOWNERS
  dependabot.yml
```

---

## What was deliberately left out of v9

- **`MIGRATION_RUNBOOK.md`** — a Drizzle and Supabase RLS playbook. Real value,
  wrong home. It stays in the application starter. The transferable parts are in
  `CODING_STANDARDS.md` § Schema + migrations as tooling-neutral rules.
- **Every `DESIGN_DECISIONS.md` and `LESSONS_LEARNED.md` entry.** Those are one
  project's history. Carrying another repo's decision log in as prefilled
  content is how you end up honoring constraints that never applied to you.
  Format preserved, content emptied.
- **All runtime scaffolding** — `app/`, `lib/`, `components/`, `supabase/`,
  `scripts/`, `tests/`, `.devcontainer/`, lockfiles, and every config file for
  Next, Vercel, Drizzle, Sentry, Tailwind, ESLint, or Vitest.
- **The `lib/__tests__/` guard tests.** Excellent, and tightly coupled to that
  codebase's imports. The pattern is described in `CODING_STANDARDS.md` §
  Static audit catalog; write the guards against the repo you are actually in.

---

## Three ideas here worth not deleting

**Findings labels.** `confirmed`, `disputed`, `manual-only`, `noise`, from
`AGENTS.md`. Tagging every finding stops a plausible-but-unverified conclusion
from propagating into a document as fact. This is the highest-value item in the
whole template and the easiest to skip.

**Correctness contracts.** Behaviors something outside the repo depends on, which
look like local inconsistencies from the inside. They get normalized by
well-meaning cleanup, and every check stays green while production breaks.
Naming them is the only defense.

**The honesty clause.** In `PRE_COMMIT_CHECKLIST.md` and `CODEX.md`. Reporting
"all checks passed" after running one of them is the failure mode these documents
exist to prevent, and it is also the most tempting shortcut for a human and an
agent alike.
