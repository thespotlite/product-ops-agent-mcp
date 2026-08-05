# Changelog

Per-slice ship log. Append-only, newest first. Updated when user-visible
behavior ships, per `CLAUDE.md` § Closeout standard.

Not a git log. Git already records every commit. This records what changed for
the people using the thing.

## Format

```
## YYYY-MM-DD — <slice name>

**Shipped:** what a user can now do that they could not before.
**Changed:** behavior that existed and is now different.
**Fixed:** what was broken.
**Internal:** structural work with no user-visible effect. Optional.
**Rollback:** how to undo it, if not simply reverting the commit.
```

## Unreleased
