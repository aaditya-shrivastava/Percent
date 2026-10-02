Historical SQL preflight snapshot. Superseded by ../customer-route-security-audit.md: the user executed the migration, verified Firebase providers, and frontend implementation is complete.

# Customer session anonymous denial SQL preflight

Hosted project: `gijyjdeohvdrnvqfqdha` (Percent), PostgreSQL 17.
Migration: `20261002022344_customer_session_anonymous_denial.sql`.
Status: local security checks pass; Firebase anonymous-provider configuration
remains unverified. Do not interpret this report as full execution readiness.

## Hosted read-only verification

Catalog SELECT confirmed both exact deployed bodies match the historical replay.
Both contain `auth.jwt()`, the literal Firebase issuer, and one intended anchor.
The captured definitions and metadata are in `customer-session-hosted-functions.json`.

| Property | current_user_id | provision_my_percent_identity |
| --- | --- | --- |
| Owner | postgres | postgres |
| EXECUTE ACL | postgres, authenticated | postgres, authenticated |
| SECURITY DEFINER | true | true |
| Volatility | stable | volatile |
| search_path | empty | empty |
| Arguments | none | none |
| Return type | uuid | uuid |

## Local proof

`node supabase/test-customer-session-preflight.mjs` replays relevant historical
migrations through the coupon foundation into disposable in-memory PGlite with
Supabase Auth/Storage boundary shims. Unrelated username and subsequent Admin/UI
migrations are excluded. The two resulting bodies match hosted definitions.
This is PostgreSQL engine validation, not a live Firebase login or HTTP test.

22 test groups pass, including literal issuer/no escaped colon, local migration
compile, before/after owner/ACL/security-definer/volatility/search-path/signature
comparison, the prepared SQL script, password/Google customer/Admin/Super Admin
resolution, new/repeated provisioning, Google contact email, anonymous provisioning
denial with no new principal, anonymous checkout/coupon denial, and 14 fail-closed
tests (seven mutations on each function). Missing/duplicate anchor, missing JWT,
wrong issuer, SECURITY INVOKER, changed search_path and unexpected body drift all
abort. Catalog comparisons after rollback prove no partial replacement commits,
including when the second target is the failing function.

Full machine-readable comparisons: `customer-session-preflight-results.json`.
The prepared SQL test executes locally and rolls back all fixture writes.

## Migration changes

Strengthened the original heuristic checks with exact catalog settings and hashes
of the audited function bodies (CRLF and surrounding whitespace normalized).
Unknown deployed body/settings drift now aborts before committing replacements.
The two UUID identity functions alone receive the anonymous-claim predicate.
Existing ACLs, owners, identity claims, issuer/audience validation and business
logic remain unchanged. No backslash precedes the issuer's colon.

## Hosted provider configuration

Read-only Supabase `/auth/v1/settings` returned `external.anonymous_users=false`.
Firebase `/v1/projects` returned project ID and authorized domains only; it does
not expose Anonymous provider enablement. The Firebase console requires a Google
sign-in in the available browser. No authenticated Firebase Admin configuration
client is available. Thus Firebase anonymous sign-in and current exploitability
cannot be concluded. No anonymous sign-up request was made.

Supabase is disabled today; the migration still hardens against previously issued
anonymous tokens and future provider configuration drift. Firebase status must be
verified read-only before claiming the full preflight complete.

## Execution boundary

Hosted activity consisted of catalog SELECT/project metadata and configuration
GETs only. No hosted DDL/DML, config changes, db push, provisioning, checkout or
test identities. Migration remains unapplied to hosted Percent. No frontend
customer guard/action/return-to work has started. Prior UI changes are preserved.

TypeScript, ESLint, production build (temporary output directory), and
`git diff --check` passed after the final migration/test changes.
