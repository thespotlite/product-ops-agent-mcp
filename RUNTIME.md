# AGENTS.md

How AI agents coordinate on this repo. The model is **flexible** by
design — you can run two agents in lanes or one agent end-to-end, and
this file tells you how to do either cleanly.

## Read first
1. `RUNTIME.md` — this repo's stack, commands, high-risk paths, contracts
2. `CLAUDE.md` — repo law, architecture boundaries, review standard
3. `CODEX.md` — implementer role and operating rules
4. `docs/ENGINEERING_PRINCIPLES.md` — anti-duplication, security, testing doctrine
5. `docs/CODING_STANDARDS.md`
6. `docs/operations/HANDOFF.md` — current state + next step

## Default roles
- **Claude Code** — planner, architect, reviewer. Translates goals
  into scoped plans, decides what's release-blocking, reviews
  Codex's output.
- **Codex** — implementer. Makes the approved, scoped change. Runs
  the checks. Reports exactly what changed.

These are starting roles, not hard assignments. The human can:
- Run Claude solo end-to-end (planning + implementation in one agent)
- Run Codex solo on a tightly-scoped change with no planning gate
- Split work between them in lanes when both are present

The choice is **per-session**, not permanent.

## Universal rules

1. **Human decisions override AI preferences.** Always.
2. **When scope is unclear, stop and ask.** Don't infer approval from
   silence.
3. **Keep changes scoped and reversible.**
4. **Handoffs happen at commit boundaries** — not mid-edit.
5. **No agent works from another agent's raw audit dump.** Work from
   `docs/operations/APPROVED_FIX_LIST.md` and documented decisions.
6. **Do not touch anything in `RUNTIME.md` § Correctness contracts outside an
   explicitly scoped task.** Those behaviors are depended on by something
   outside this repo and they look like local style inconsistencies from the
   inside. Normalizing one is the most likely way to break production with
   every check still green.
7. **Any new scheduled job ships with failure detection** or an explicit note
   in the handoff explaining why it has none.

## Execution modes

Pick a mode at the start of a session and record it in
`docs/operations/HANDOFF.md`. Default is sequential.

### Sequential (default)
One agent edits at a time. Use for:
- Shared-state work (schema, auth, env config)
- Small scoped tasks where parallelism just adds overhead
- Any session where file boundaries are unclear

### Parallel-isolated
Two agents working on declared, non-overlapping file sets. Use for:
- Independent feature work (Codex implements an API route while you
  audit a different surface)
- Audit + implementation on separate areas of the codebase

Rules when in this mode:
- Claude (or the human) declares file boundaries before work starts
- Each agent's file set is listed in `HANDOFF.md` under "Active lanes"
- No agent crosses into another's declared files
- If an agent discovers a need to touch files outside its lane, it
  stops and surfaces the dependency
- Merge happens at a coordination checkpoint, not ad hoc

### Serialized-critical
Forced single-agent mode for high-risk surfaces. The path list is per repo, in
`RUNTIME.md` § High-risk paths. It should always include:
- auth, authorization, and env or secrets access
- schema and migrations
- the audit or guard tests themselves
- `.github/`
- anything in `RUNTIME.md` § Correctness contracts
- anything listed under "Do not touch without approval" in `HANDOFF.md`

## Conflict resolution

- Human > Claude > Codex.
- If two agents disagree, Claude arbitrates. If Claude is one of the
  disagreeing parties, the human decides.
- If an agent finds a contradiction between docs, `AGENTS.md` and
  `CLAUDE.md` win. Flag the contradiction in your report.

## Findings labels

When auditing or surfacing issues, tag every finding:

- **confirmed** — verified, evidence provided
- **disputed** — disagreement exists, needs human decision
- **manual-only** — cannot be verified by AI, requires human action
- **noise** — not a real issue, rejected with reason

These tags propagate to `docs/operations/APPROVED_FIX_LIST.md`.

## Recommended sequence (default flow)

1. Human or Claude defines scope and chooses execution mode
2. Claude writes the scoped plan
3. If parallel-isolated, Claude declares lanes in `HANDOFF.md`
4. Codex implements
5. Coordination checkpoint: Claude reviews output before next phase
6. Human signs off
7. Update `CHANGELOG.md` and `HANDOFF.md`

## Solo-Claude flow

When Claude runs solo end-to-end:

1. Write the scoped plan inline
2. Implement against the plan
3. Run the full verification set from `RUNTIME.md` § Verify commands, plus any
   structural audits if a guard rule was touched
4. Self-review using the `CLAUDE.md` § Review standard
5. Update docs as required
6. Update `HANDOFF.md` and `CHANGELOG.md`

The discipline is the same — the difference is only that you're doing
both halves yourself, so the temptation to skip the review pass goes
up. Don't skip it.
