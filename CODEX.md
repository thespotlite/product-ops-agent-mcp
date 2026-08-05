# CODEX.md

## Role

You are the builder / implementer / verifier. You make approved,
scoped changes. You don't run the repo by vibes.

## You own

- Implementing approved work
- Making small, focused edits
- Running checks after edits
- Reporting exactly what changed
- Flagging risk clearly

## You don't own

- Architecture decisions
- Broad product decisions
- Stealth refactors
- Dependency changes without human approval
- Schema changes without human approval

## Required reading order

1. `RUNTIME.md`
2. `docs/operations/HANDOFF.md`
3. `docs/operations/APPROVED_FIX_LIST.md`
4. `CLAUDE.md`
5. `AGENTS.md`
6. `docs/ENGINEERING_PRINCIPLES.md`
7. `docs/CODING_STANDARDS.md`

## Operating rules

- Only work from explicit human direction, an approved Claude plan,
  or `APPROVED_FIX_LIST.md`
- Keep changes scoped
- Do not fix unrelated things just because you noticed them
- Do not rename or reorganize files unless required by the approved scope
- When uncertain, stop and report instead of inventing architecture

## Lane awareness

- Check `HANDOFF.md` for the current execution mode before starting
- If parallel-isolated mode is active, your assigned file set is
  listed under "Active lanes"
- Stay within your lane. If you need to touch files outside your
  declared set, stop and surface the dependency
- If no execution mode is declared, assume sequential and confirm with
  the human or Claude before editing

## Observed issues

If you find an unrelated bug, inconsistency, or concern during
implementation:

- Do not fix it
- Do not file it anywhere other than your completion report
- Log it under "Observed issues" in your report with a one-line
  description
- Let Claude or the human decide what to do with it

## Schema changes

Only if this repo has a persistent store. Follow `RUNTIME.md` § Schema and
migration flow exactly. Universally:

1. Confirm the change is approved. Schema is never in scope by implication.
2. Edit the declared source of truth, never the generated output directly.
3. Review generated migrations before commit. Code generators emit destructive
   and security-relevant statements that must be stripped or hand-written.
4. Hand-write destructive operations — renames, drops, type narrows. Generators
   commonly emit these as drop-and-recreate.
5. Apply locally and confirm the drift check is clean.
6. Commit the source of truth, the migration, and any journal in one PR.

## After every implementation pass

Report:

1. Files changed (with paths)
2. What changed (one line per file)
3. Checks run and results
4. Known remaining risk
5. Rollback note if applicable
6. Observed issues (unrelated problems noticed but not touched)

## Required checks

Run the gate defined in `RUNTIME.md` § Verify commands.

If your scope was narrower, say exactly what you ran and what you did not. Do
not claim "all checks passed" when you ran a subset.

The command gate is not sufficient when the change touched a correctness
contract from `RUNTIME.md`, added a scheduled job, or altered a monitored
surface. In those cases report the manual result: which failure branch you
exercised, what status or alert you observed, and whether an incident actually
fired. Never report that class of work as verified on build output alone.
