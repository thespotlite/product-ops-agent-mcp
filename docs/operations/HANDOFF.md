## Execution mode

`sequential`

## Current state

The four-tool MCP server is deployed at `domo-mcp.abush.workers.dev` and
verified end to end under browser-based Cloudflare Access with Entra ID. Live
Domo queries, the full query reference, and attributed D1 logging work. The
server is not reachable by Claude or another MCP client yet.

## Next step

The auth pass. Browser-mode Access answers non-browser clients with a 302 to an
HTML login page, confirmed by direct test, so an MCP client cannot authenticate.
The Worker must become its own OAuth 2.1 authorization server using
`@cloudflare/workers-oauth-provider`, with Cloudflare Access for SaaS as the
upstream identity provider. Cloudflare documents this pattern at
https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/secure-mcp-servers/.

Scope: add the dependency, restructure `src/index.ts`, rewrite
`src/identity.ts` away from `Cf-Access-Jwt-Assertion` header parsing, and use an
Access for SaaS OIDC application plus two new secrets created by the human. Do
not begin until the human provides a scoped spec.

## Do not touch without approval

Everything in RUNTIME.md § High-risk paths, plus reference/DOMO_Reference.md.

## Context the next session needs

The legacy `domo-chatgpt-proxy` Worker is still live, still Public, and still
serving the ChatGPT GPT for Product Operations. Delete it at cutover, not
before.

Two production data findings still need recording in
`reference/DOMO_Reference.md`: invoice dates have zero nulls, and the dataset
begins 2021-01-04 rather than 2020 as retired documentation claimed. That file
is outside this lane and is left to the human.
