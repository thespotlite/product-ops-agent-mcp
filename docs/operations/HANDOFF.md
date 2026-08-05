## Execution mode

`sequential`

## Current state

Governance hygiene is complete: internal-governance-template-v1 is restored at
its authoritative directory structure, flat browser-download copies are
removed, KB Worker configs are merged, and the implementation spec is at
docs/domo-mcp-spec.md.

Data profiling complete against the legacy proxy. Verified anchors are in
section 9 of the reference doc.

## Next step

Implement the code pass.

## Do not touch without approval

Everything in RUNTIME.md § High-risk paths, plus reference/DOMO_Reference.md.

## Context the next session needs

The legacy domo-chatgpt-proxy worker is still live and unauthenticated, serving
the ChatGPT GPT. It is deleted at cutover, step 9, not before.

Monitoring is a known deferred gap. See RUNTIME.md § Monitoring.

RUNTIME.md currently starts `# RUNTIME.md — __APP_NAME__`; the hygiene pass
left it untouched because the expected guarded heading was absent. Files under
src/ and migrations/, plus package.json and wrangler.jsonc, remain from an
interrupted earlier implementation attempt and were not reviewed or changed in
the hygiene pass. The requested `git mv` could not update the index because
.git is read-only in this environment; the spec was moved on the filesystem.
