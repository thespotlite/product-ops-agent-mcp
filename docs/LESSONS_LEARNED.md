# Lessons Learned

Cross-project lessons. Things that cost real time once and should not cost it
again in the next repo.

Repo-specific quirks go in `RUNTIME.md` § Known gotchas instead. The test: would
this still be true in a different codebase? If yes, it belongs here.

Empty on purpose. Earn the entries.

## Format

```
## <short title>

**Cost:** how long it took to find, roughly.
**Symptom:** what it looked like from the outside.
**Cause:** what was actually wrong.
**Fix:** what resolved it.
**Guard:** the test, lint rule, or checklist entry added so it cannot recur.
  If none, say so and say why.
```

## Standing lessons

Two that apply everywhere and are worth having before the first incident.

### A passing build is not a passing test

Type checks and builds prove the code compiles against its own assumptions.
They prove nothing about runtime data shapes, interactive behavior, or whether
an alert fires. Anything a user touches gets smoke tested by a human.

### An aggregate can hide the finding

A metric averaged across an unsegmented population can look clean while the
segments underneath diverge wildly, particularly when one segment dominates the
volume. Before drawing a conclusion from a summary figure, check whether the
population is homogeneous enough for the summary to mean anything.
