# Smoke Test Matrix

The user journeys that must work before any release. Run these
manually against the preview deployment before promoting to
production. Two automated assertions per flow at minimum (Playwright
or Vitest UI test).

| # | Flow | What you're verifying | Status |
|---|---|---|---|
| 1 | Sign in with Microsoft | OAuth round-trip, profile bootstrap, role loads | pending |
| 2 | Sign out | Session ends, redirect to home, repeat sign-in works | pending |
| 3 | Main create flow | User completes the primary record-creation flow end to end | pending |
| 4 | Admin review flow | Reviewer sees the record, acts on it, state changes propagate | pending |
| 5 | Notification flow | Email or in-app signal arrives at the right recipient with the right content | pending |
| 6 | Re-entry / resume | User returns mid-flow (closed tab, new device) and can pick up cleanly | pending |
| 7 | Error recovery | Trigger a deliberate upstream failure; UI surfaces an actionable error, retry works | pending |

## Per-release run

For each flow:
1. Walk through it against the preview URL
2. Record screenshots or a recording in `docs/operations/HANDOFF.md`
3. Update the Status column ("pass YYYY-MM-DD" or "fail — see HANDOFF")
4. Only promote to production once every row is `pass <today>`

## Add a flow when

- A new user journey ships that's load-bearing for the product
- A regression in the same area happens twice (clearly the existing
  flows aren't covering it)

Don't add a flow per feature — the matrix loses signal if it grows
faster than the product.
