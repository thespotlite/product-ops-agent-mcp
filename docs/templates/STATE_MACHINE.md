# State Machine

> Fill in when the app has statuses, approvals, escalations, queues,
> or terminal states. Delete this file if your app is purely
> stateless CRUD.

## Why this exists

Prevents status logic from living only in scattered code + UI
assumptions. When the state machine is in this doc, anyone can audit
"can a ticket move from `closed` back to `open`?" without grepping.

## Entities

List the entities that change state. Each gets its own table below.

## States

For each entity:

| State | Meaning | Operator sees | End user sees |
|---|---|---|---|
| draft | created but not submitted | full edit UI | nothing |
| open | submitted, awaiting triage | triage queue | "Received" |
| in_progress | actively being worked | active queue | "Working on it" |
| resolved | done, awaiting confirmation | resolved queue | confirm/reopen UI |
| closed | confirmed done | archive | read-only |

## Transitions

| Event | From | To | Trigger | Side effects |
|---|---|---|---|---|
| submit | draft | open | operator action | notify reviewer |
| triage | open | in_progress | reviewer action | assign owner |
| resolve | in_progress | resolved | owner action | notify submitter |
| confirm | resolved | closed | submitter action | none |
| reopen | resolved | in_progress | submitter action | notify owner |

## Rules

- **Server is authoritative.** Client UI may briefly mirror an
  optimistic transition but the server's view always wins.
- **Terminal states are explicit.** `closed` is terminal; it cannot
  go back to any active state without an explicit "create new"
  operation.
- **Side effects must be idempotent.** A retry of a transition must
  not double-notify.

## Open questions

List unresolved edge cases here before implementation gets too deep.
- What happens if the submitter never confirms?
- Is there a time-based auto-close?
- Can multiple owners exist?
