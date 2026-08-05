# Product Requirements Document

> Fill in once for this specific product. Move out of `templates/`
> (rename, or move up to `docs/`) once you have real answers.

## 1. Problem
What business problem are we solving? Be specific — "make ops more
efficient" is not a problem statement.

## 2. Users
Who uses this app? What roles, how many of each, what's their daily
context?

## 3. Goals
What should improve if this app succeeds? Tie each goal to a real
metric where possible.

## 4. Out of scope
What are we explicitly NOT building in v1? Important — this is where
scope discipline lives.

## 5. Core flows
List the 3–7 flows that matter most. Each flow should be one line
("Operator submits a ticket → triage assigns → resolver responds →
operator confirms resolution") not a wireframe.

## 6. Permissions
What can each role see or do? Translate this into:
- The `role` field values on `profiles`
- Which routes require which roles (`createApiHandler({ roles: [...] })`)
- Which access policies on which tables

## 7. Data model summary
List the major entities and their relationships. Don't draw an ERD —
list the entities, their owners, their key fields, and the foreign
keys between them.

## 8. Integrations
What external services? List each with:
- Purpose
- Where credentials live (env var name)
- Failure mode (what happens if it's down)

## 9. Risks
What could go wrong technically or operationally? Be honest. The
risks you don't write down here are the ones that bite later.

## 10. Success metric
One simple metric that proves this matters. Not a dashboard — one
number.
