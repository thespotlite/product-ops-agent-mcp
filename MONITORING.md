# Design Decisions

Append-only log of decisions that are settled. Agents do not re-litigate
anything recorded here; they raise it with the human if they think it is wrong.

Empty on purpose. Add the first entry when you make the first decision worth
remembering.

## Format

```
## DD-001 — <short title>

**Date:** YYYY-MM-DD
**Status:** accepted | superseded by DD-0NN
**Decision:** what was decided, in one or two sentences.
**Context:** what forced the choice.
**Alternatives rejected:** what else was considered, and why not.
**Consequences:** what this makes easy, what it makes hard, what it locks in.
```

## Why this file exists

Without it, every settled question gets reopened by whoever arrives next,
usually an agent that sees an inconsistency and proposes a tidy-up. A decision
you cannot point to is a decision you will make again.

Record the rejected alternatives. Six months on, the reason a choice looks wrong
is usually that the constraint which produced it is no longer visible.
