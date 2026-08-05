# Monitoring

Runtime specifics — what is monitored, by what, where monitors are declared —
live in `RUNTIME.md` § Monitoring. This file is the doctrine.

## The rule

**Monitoring is part of shipping, not a follow-up ticket.** A feature that can
fail silently is not done.

## Health signals degrade in a way the monitor can see

If a monitored surface reports failure, it must do so through the channel the
monitor actually reads. Most monitors check a status code and never parse a
response body.

This is the single most common way monitoring gets broken, and it never looks
like vandalism. It looks like a consistency improvement: "every other route
returns 200 with an `ok` flag, so this one should too." Making that change turns
the monitor permanently green while the system is down.

Health surfaces are therefore correctness contracts. List them in
`RUNTIME.md` § Correctness contracts and enforce them with a test.

Three properties usually need protecting:

1. **It fails loudly** through the channel the monitor reads.
2. **It stays reachable** by the monitor. External monitors have no credentials.
3. **It stays cheap.** It runs on a fixed interval forever. No joins, no scans,
   no per-feature fan-out.

## Every scheduled job has failure detection

A job that stops running is invisible by default. Nothing errors, because
nothing ran.

Every scheduled job either reports to a heartbeat that alerts on a missed
interval, or ships with an explicit note in `docs/operations/HANDOFF.md` saying
it has no failure detection and why that is acceptable.

## Heartbeat URLs are credentials

A heartbeat URL is a bearer token in path form. Anyone holding it can suppress
your alerts. Treat it as **Restricted** under `docs/DATA_CLASSIFICATION.md`:
secret store only, never a committed literal, never a plaintext database column,
never a log line, never an API response.

## Monitors are declared, not hand-made

If monitors are managed as code, creating one in a vendor UI means the next apply
reverts it and the alert silently disappears. Record the source of truth in
`RUNTIME.md` and use it.

## Verification standard

**A successful deploy proves the platform accepted your configuration. It proves
nothing about whether a human gets paged.**

Monitoring work is never verified on build or apply output alone. To call it
done:

- The healthy path was observed returning what the monitor expects
- The failure path was **deliberately exercised**, not assumed
- For a new scheduled job, the heartbeat was allowed to lapse past its interval
  plus grace once, and the incident was observed firing

Report which of these you actually did. "Should work" is not a result.
