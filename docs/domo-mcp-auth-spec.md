# Codex Task: DOMO MCP Auth Pass

## Objective

Make `domo-mcp` reachable by MCP clients that cannot complete a browser login,
specifically Claude's custom connector.

The Worker becomes an OAuth 2.1 authorization server to MCP clients and an OAuth
client to Cloudflare Access for SaaS. Users authenticate through Entra ID via
Access; the Worker receives their verified identity and never sees their
credentials.

This replaces header-based Access JWT verification, which cannot work for
non-browser clients. Confirmed by direct test: browser-mode Access answers a
machine client with HTTP 302 to an HTML login page.

**In scope:** OAuth provider integration, upstream Access OIDC client, identity
plumbing, KV binding, secrets, tests.

**Out of scope:** the four tools' behavior, the Domo query path, validation, the
row cap, D1 logging semantics. Those work and are verified in production. Do not
redesign them.

## What must not break

Four correctness contracts from `RUNTIME.md`, each with an existing test. All
four must still pass, unmodified in intent, at the end of this pass.

1. Row cap errors rather than truncating.
2. `at_limit` is true only when `numRows` equals the requested `LIMIT`, proven in
   both directions.
3. The `run_sql` description contains the three-class delivery exclusion, the
   `table` alias rule, the double-quoting rule, and both computed-field rules.
4. `get_query_reference` returns `reference/DOMO_Reference.md` in full.

Also preserved:

- **Single Domo egress.** `src/domo.ts` remains the only module that reaches
  `api.domo.com`, including the whitespace normalization added for the
  multi-line SQL bug.
- **Validation before egress.** No path reaches Domo without passing
  `validateSql`.
- **Per-user attribution in the D1 log.** `user_email` must continue to carry the
  real authenticated user's email address, not a service identity and not a
  constant. This is the single most important requirement in this spec after the
  contracts: the log exists so that Phase 2 tools can be specced from evidence
  about who asked what, and `RUNTIME.md` records a deliberate data-classification
  exception on that basis.

## Reference implementation

Read Cloudflare's working example before writing anything:
`https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-cf-access`

It implements exactly this pattern: `@cloudflare/workers-oauth-provider` with
Access for SaaS as the upstream OIDC provider. Port its OAuth plumbing into this
repo. Do not port its tools, its structure, or its conventions.

Official guide:
`https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/secure-mcp-servers/`

Resolve the current `@cloudflare/workers-oauth-provider` version against the npm
registry. Report it. Note that MCP spec revision 2026-07-28 deprecates Dynamic
Client Registration in favor of CIMD, but the registration endpoint remains
useful for client compatibility, so keep it enabled unless the library's current
docs say otherwise.

## Architecture

`src/index.ts` currently exports a fetch handler that verifies the Access JWT
header, then dispatches to `createMcpHandler`. It becomes an `OAuthProvider`
instance configured with:

- **apiHandler** — the MCP endpoint at `/mcp`, receiving already-authenticated
  user props from the provider
- **defaultHandler** — the upstream OAuth flow: `/authorize` redirects to the
  Access authorization endpoint, `/callback` exchanges the code at the Access
  token endpoint, reads the user's email from the resulting ID token claims, and
  calls the provider's completion function with that email in props
- **authorizeEndpoint**, **tokenEndpoint**, **clientRegistrationEndpoint** — the
  provider's own OAuth 2.1 surface, consumed by MCP clients

The provider issues its own tokens to MCP clients and hands the MCP handler the
authenticated user. Your code performs no token validation of its own.

`src/identity.ts` no longer parses `Cf-Access-Jwt-Assertion`. The email arrives
from OAuth props. Either rewrite it to extract and validate email from props, or
delete it and inline that, whichever is cleaner. If deleted, remove
`src/types.ts` fields that become dead.

**Fail closed is still required.** If props arrive without a usable email, reject
the request rather than logging a placeholder. An unattributed query against
cost and margin data is the failure mode this rule exists to prevent.

## Configuration

### KV namespace

`@cloudflare/workers-oauth-provider` requires a KV namespace for OAuth state.
Add the binding to `wrangler.jsonc` with `id` marked `TODO`. Binding name
`OAUTH_KV`, matching the reference implementation.

### Secrets

Six. All are set by the human; reference them as env bindings and mark them as
blockers in your report.

| Secret | Source |
|---|---|
| `ACCESS_CLIENT_ID` | Access for SaaS app, Client ID |
| `ACCESS_CLIENT_SECRET` | Access for SaaS app, Client secret |
| `ACCESS_TOKEN_URL` | `https://motz-it.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<CLIENT_ID>/token` |
| `ACCESS_AUTHORIZATION_URL` | `https://motz-it.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<CLIENT_ID>/authorization` |
| `ACCESS_JWKS_URL` | `https://motz-it.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<CLIENT_ID>/jwks` |
| `COOKIE_ENCRYPTION_KEY` | `openssl rand -hex 32` |

The three URLs embed the Access for SaaS client ID in their path. Team domain is
`motz-it.cloudflareaccess.com`.

### Vars to remove

`ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc` served the header
verification path. Remove them once nothing references them, and confirm nothing
does.

## Tests

Rewrite `test/identity.test.ts` for the new model. At minimum:

- A request with no OAuth props is rejected.
- Props lacking an email are rejected. This is the fail-closed contract.
- Props carrying a valid email reach the MCP handler and that email is what
  `log.ts` receives.

That last one is a contract test, not a convenience test. Add it to the guard
suite. `user_email` silently becoming a constant is exactly the class of failure
that looks fine in production and destroys the log's value.

Keep all existing validation, domo, tools, and logging tests passing.

## Not in this lane

- `npx wrangler kv namespace create "OAUTH_KV"`
- Creating the Access for SaaS OIDC application
- `wrangler secret put` for all six secrets
- Turning off browser-mode Access on the Worker's `workers.dev` URL
- Deploying
- Registering the connector in Claude

Deliver code, `wrangler.jsonc` with the KV `id` marked `TODO`, and a report
listing exactly what the human must do to deploy.

## Acceptance criteria

Verify against behavior, not types.

1. `npm run type-check`, `npx oxlint`, `npm test`, and
   `npx wrangler deploy --dry-run` all pass.
2. All four correctness-contract tests still pass, unmodified in intent.
3. `grep` confirms no remaining reference to `Cf-Access-Jwt-Assertion`,
   `ACCESS_AUD`, or `ACCESS_TEAM_DOMAIN` anywhere in `src/`.
4. `grep` confirms `api.domo.com` appears only in `src/domo.ts`.
5. An unauthenticated request to `/mcp` returns 401 with a `WWW-Authenticate`
   header pointing at the provider's metadata. A 302, or a 401 without that
   header, means an MCP client cannot begin the OAuth flow and this pass has
   failed its primary objective.
6. The provider's OAuth metadata endpoint responds and advertises the
   authorization, token, and registration endpoints.
7. A request whose props lack an email is rejected, with a test proving it.
8. The email reaching `log.ts` is the one in the props, with a test proving it.

Report the resolved `@cloudflare/workers-oauth-provider` version and whether the
library's current documentation contradicts anything in this spec. If it does,
follow the library and say so.

## Cutover

Human steps, in order. Steps 1 and 2 can happen while you work.

1. Create the Access for SaaS OIDC application. Redirect URL
   `https://domo-mcp.abush.workers.dev/callback`. Copy Client ID, Client secret,
   and the three endpoints. Attach an Access policy scoped to the Entra group,
   and enable Refresh tokens under Advanced settings to reduce login frequency.
2. `npx wrangler kv namespace create "OAUTH_KV"`, then paste the id into
   `wrangler.jsonc`.
3. Set all six secrets.
4. Deploy.
5. **Turn the Worker's `workers.dev` Access setting back to Public.** Browser-mode
   Access would intercept `/authorize` and `/callback` and break the OAuth flow
   before it starts. Security now comes from the OAuth provider plus the Access
   for SaaS policy, not from hostname-level Access.
6. Test with MCP Inspector or Workers AI Playground before touching Claude.
   Both support remote MCP servers and give clearer errors than a connector.
7. Claude org Owner registers the custom connector at organization level.
   Members then connect individually.
8. Verify a real query end to end, then confirm the D1 log shows the connecting
   user's actual email rather than a constant.
