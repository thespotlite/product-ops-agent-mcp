## Execution mode

`sequential`

## Current state

The OAuth auth pass is implemented and verified locally, but not deployed. The
Worker now exposes OAuth 2.1 discovery, authorization, token, and registration
endpoints; delegates user login to Cloudflare Access for SaaS; and carries the
verified email through OAuth props into the D1 query log. The existing
production deployment remains behind browser-mode Access and is unchanged.

## Next step

Human cutover work: create the Access for SaaS OIDC application and OAUTH_KV
namespace, replace the `TODO` KV id in `wrangler.jsonc`, set all six new secrets,
deploy, make the workers.dev hostname Public so it does not intercept the OAuth
routes, and smoke with MCP Inspector before registering the Claude connector.

## Do not touch without approval

Everything in RUNTIME.md § High-risk paths, plus reference/DOMO_Reference.md.

## Context the next session needs

`@cloudflare/workers-oauth-provider` resolved to 0.10.1. Current library guidance
requires explicit user consent and recommends CIMD, so the implementation has a
CSRF-protected approval screen, enables CIMD with
`global_fetch_strictly_public`, and retains `/register` for compatibility.

Local verification proved unauthenticated `/mcp` returns 401 with an RFC 9728
metadata challenge, and discovery advertises `/authorize`, `/token`, and
`/register`. A real Access/Entra callback remains manual-only until the six
secrets and SaaS application exist.

The legacy `domo-chatgpt-proxy` Worker is still live, still Public, and still
serving the ChatGPT GPT for Product Operations. Delete it at cutover, not
before.

Two production data findings still need recording in
`reference/DOMO_Reference.md`: invoice dates have zero nulls, and the dataset
begins 2021-01-04 rather than 2020 as retired documentation claimed. That file
is outside this lane and is left to the human.
