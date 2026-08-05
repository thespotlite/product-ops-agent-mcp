# Data Classification

Four tiers. Each tier has explicit storage, transport, and access
rules. Update the table for this project when you add a new data
class — don't invent a fifth tier.

## Tiers

| Tier | Examples | Where it may live | Who may access |
|---|---|---|---|
| **Public** | Marketing copy, public health endpoint output, version string | Anywhere | Anyone |
| **Internal** | Internal-only feature copy, role names, non-sensitive config | Primary datastore and platform logs OK | Authenticated users |
| **Confidential** | Email addresses, names, phone numbers, internal ticket bodies, customer identifiers, unit cost and margin | Primary datastore with record-level access control, never in logs | Authenticated + authorized |
| **Restricted** | Secrets (API keys, service-role keys), DB connection strings, OAuth client secrets | Platform secret store only; never in code, never in logs | Operators only |

## Rules

1. **Restricted data never enters the codebase.** Not even in tests,
   not even as a placeholder that's "obviously fake." If a regex
   could match it, you've reduced its protective value. Use env vars
   for everything secret.

2. **Confidential data never appears in logs.** The structured logger
   in `lib/observability/logger.ts` is safe for IDs, request IDs,
   and route paths. It's not safe for email addresses, names, or
   message bodies. If you must log a record for debugging, log its
   ID and look up the row separately.

3. **Public-facing errors strip all upstream detail.** Datastore error
   messages may quote column names, query fragments, or user input.
   Map every public-facing error through a sanitizer; log the
   original server-side with the request ID.

4. **Storage paths are not security boundaries.** A user knowing
   "this attachment is at `documents/abc-123.pdf`" is not
   authorization. The owning record's ownership is. See DD-011.

5. **PII export requires explicit redaction.** Any export feature
   (CSV, PDF, JSON download) that touches Confidential data must
   route through a redaction layer before reaching the file. Test
   the redactor with realistic inputs — UUIDs, request IDs, and
   nested error messages are common leak vectors.

6. **Connection strings are Restricted.** They contain the database
   password. Treat them like a service-role key — secret store only, no
   logging, no Slack pastes.

## When a field crosses tiers

If a previously-Internal field gains Confidential data (e.g.
"description" starts accepting customer email addresses), update:

1. The schema if the column type needs to change (e.g. encrypted-at-rest)
2. The record-level access policy if the read surface changes
3. Any export / log / redaction code that touched the old shape
4. This document

Don't quietly let the meaning drift — the next engineer reading
this table will assume the old classification.
