## Execution mode

`sequential`

## Current state

The OAuth auth pass is deployed, and the immutable redirect-header production
bug in consent submission is fixed locally and awaiting deployment. The
Worker now exposes OAuth 2.1 discovery, authorization, token, and registration
endpoints; delegates user login to Cloudflare Access for SaaS; and carries the
verified email through OAuth props into the D1 query log.

## Next step

Deploy the consent redirect fix, then repeat the full OAuth flow through MCP
Inspector. Confirm consent POST and callback both redirect successfully before
registering the Claude connector.

## Do not touch without approval

Everything in RUNTIME.md § High-risk paths, plus reference/DOMO_Reference.md.

## Context the next session needs

`@cloudflare/workers-oauth-provider` resolved to 0.10.1. Current library guidance
requires explicit user consent and recommends CIMD, so the implementation has a
CSRF-protected approval screen, enables CIMD with
`global_fetch_strictly_public`, and retains `/register` for compatibility.

Local verification proved unauthenticated `/mcp` returns 401 with an RFC 9728
metadata challenge, and discovery advertises `/authorize`, `/token`, and
`/register`. Production Access, Entra, KV, and secret configuration exist; the
full live callback must be repeated after this fix is deployed.

Production exposed that `Response.redirect()` headers are immutable in Workers.
Consent POST attempted to append its cookie after constructing that response.
Both cookie-plus-redirect paths now construct a new 302 with `Location` and
`Set-Cookie` together, with regression tests covering consent and callback.

The legacy `domo-chatgpt-proxy` Worker is still live, still Public, and still
serving the ChatGPT GPT for Product Operations. Delete it at cutover, not
before.

Two production data findings still need recording in
`reference/DOMO_Reference.md`: invoice dates have zero nulls, and the dataset
begins 2021-01-04 rather than 2020 as retired documentation claimed. That file
is outside this lane and is left to the human.
