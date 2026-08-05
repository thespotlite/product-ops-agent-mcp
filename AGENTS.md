# Handoff

Living document. Current state, active lanes, next step. Overwrite freely — this
is not a log. The log is `CHANGELOG.md`.

Update this before ending any session, per `CLAUDE.md` § Closeout standard.

## Execution mode

`sequential` | `parallel-isolated` | `serialized-critical`

Declare before any agent edits. Per `AGENTS.md`, absent a declaration, assume
sequential and confirm with the human first.

## Active lanes

Only when `parallel-isolated` is in effect. List each agent's declared file set.
No agent crosses into another's lane; if it needs to, it stops and surfaces the
dependency.

| Agent | File set |
|---|---|
| | |

## Current state

What is done and working.

## Next step

The single recommended starting point for the next session. One thing, not a
list.

## Do not touch without approval

Beyond `RUNTIME.md` § High-risk paths.

## Context the next session needs

Anything non-obvious. In-flight decisions, deliberate temporary states, things
that look like bugs but are not.
