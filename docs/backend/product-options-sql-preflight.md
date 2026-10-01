# Product Options SQL preflight

Date: 30 September 2026. Scope: Settings → Product Options, admin-managed Colors + Sizes. Target migration: `supabase/migrations/20260930113030_product_options_foundation.sql`.

**PRODUCT OPTIONS SQL PREFLIGHT COMPLETE — READY FOR MANUAL EXECUTION**

## Target and hosted read-only verification

Local `supabase/.temp/project-ref` contains `gijyjdeohvdrnvqfqdha`. The connector's exact-project lookup independently returned **Percent**, reference **gijyjdeohvdrnvqfqdha**, region **ap-south-1**, status **ACTIVE_HEALTHY**. No project listing or access to any other project was needed.

Live read-only SQL was available. Only SELECT queries against the exact Percent target were issued. Observed:

| Check | Result |
|---|---|
| Existing colours | 5 |
| Existing product variants | 221 |
| Distinct variant sizes | S, M, L, XL |
| Normalized colour-name collisions | None |
| Invalid colour label lengths | None |
| Existing colour touch trigger | One enabled `touch_updated_at`, BEFORE UPDATE, calling `private.touch_updated_at()` |
| Touch function | `new.updated_at = now()`; empty search path |
| Separate colour column ACLs | None |
| Current PUBLIC colour mutation grants | None |
| Current anon colour grants | SELECT only |
| Current authenticated colour grants | SELECT, INSERT, UPDATE, DELETE; the migration revokes the three mutations |
| Current service_role colour grants | Retained trusted-server privileges |
| Required identity/admin helpers | Both present |
| New RPC name conflicts | None |
| `product_size_options` | Absent, as expected before migration |
| Migration history version `20260930113030` | Absent; migration remains unapplied |

Hosted colours match the seed and authoritative local colour definitions:

| Slug | Label | Swatch | Existing UUID |
|---|---|---|---|
| burgundy | Burgundy | #6b2737 | 2c703fc0-94c4-41c7-a7d4-74e9c1161ce6 |
| ivory | Soft Ivory | #f5f3ee | b7a948d8-5eb7-43ae-a10a-f50019c949fc |
| charcoal | Charcoal | #171717 | bc3aa00e-a426-4586-a010-77e4efc9d408 |
| stone | Stone | #d8d0c8 | f185a422-499e-4c28-aec9-1a4d43cbf785 |
| taupe | Taupe Grey | #77736d | fec79034-eba3-44fc-a9f4-c71ca0dd2403 |

## Local compilation and prerequisites

Ran `node supabase/test-product-options-preflight.mjs` successfully using the installed PGlite PostgreSQL runtime. The actual migration's BEGIN/COMMIT transaction completed locally, including all functions, triggers, indexes, constraints and grants/revokes. All four RPCs were executed locally to exercise their bodies, not merely parse their definitions.

The scoped fixture replays the actual historical `colours` table and `private.touch_updated_at()` definitions extracted from the foundation migration. The historical generic trigger-creation block was inspected specifically for `colours`; its colour trigger is reproduced in the fixture and independently confirmed live. Other prerequisites are hosted-shaped local variant fixtures and protected role/identity test helpers. This is not a full replay of unrelated application migrations or an end-to-end identity-provider test. No unrelated subsystem logic was inspected or changed as part of this preflight.

The previous fixture incorrectly substituted `clock_timestamp()`; it now uses the real historical `now()` function. The tests assert colour-save and both reorder operations change each affected row's version. The existing trigger updates timestamps per transaction; RPC tests use separate transactions as normal API calls do. These tests cover optimistic-version conflict handling, not a multi-session contention stress test.

## Results

**118 assertions and 45 expected-rejection checks passed.** See `product-options-preflight-results.json` for the machine-readable summary.

| Requirement | Result |
|---|---|
| Existing UUIDs and size snapshots | All 221 fixture variants retain their colour references and size strings after migration; existing identities remain intact after option mutations |
| Ordinary variant updates | Allowed when colour/size are unchanged, including disabled colour/size and legacy size after option rename |
| Disabled guards | New or changed disabled colours/sizes rejected; new unmanaged size rejected; enabled managed options accepted |
| Colour normalization | Existing Burgundy conflicts with ` burgundy` and `BURGUNDY`; case/space variants of a newly created colour also rejected |
| Size normalization | Existing M conflicts with `M` and ` m`; case/space variants of a new size also rejected |
| Unused colour rename | Allowed |
| Used colour rename | Rejected with 22023 |
| Used colour swatch / disable / enable / reorder | Allowed without rewriting variant references |
| Size rename and disable | Existing `product_variants.size` remains unchanged; ordinary update of its now-legacy snapshot succeeds |
| Colour and size reorder | Duplicate IDs rejected with 22023; incomplete lists and stale versions rejected with PT409; successful complete reorder persists ordering and changes row versions |
| Stale option saves | Both colour and size stale saves rejected with PT409 |
| All four RPCs | Internal `private.current_user_id()` + `private.is_admin()` guards verified; logged-out/customer denied; admin/super_admin allowed |
| Execution privileges | Tested under actual local anon/authenticated SQL roles in addition to internal guard tests under the database-owner role |
| No hard delete | No colour/size delete RPC introduced; disable remains the supported operation |
| Timestamp trigger | Existing colour trigger reused exactly once; no duplicate added |
| Storefront SELECT | Preserved on colours |
| Direct mutations | PUBLIC, anon and authenticated have no INSERT/UPDATE/DELETE on colours or size options after local migration |

The four RPCs are `admin_list_product_options()`, `save_product_color_option(...)`, `save_product_size_option(...)`, and `admin_reorder_product_options(...)`. Their authority comes from protected identity/admin helper calls, not email, external-provider identifiers or browser storage. Test identity helpers are local shims, and no authentication implementation was changed.

## Expected post-migration state

- 5 existing colours, same UUIDs/labels/slugs/swatches, enabled, ordered Burgundy → Soft Ivory → Charcoal → Stone → Taupe Grey.
- 4 managed size options: S → M → L → XL, enabled.
- 221 existing product variants, unchanged identities and size snapshots.
- Direct colour writes revoked from PUBLIC/anon/authenticated; existing SELECT access retained.
- Private size-option table with RLS; managed access through internally authorized RPCs.

Counts are the immediate post-migration expectations, excluding disposable test-created options.

## Exact changes in this task

**Migration SQL: no changes required.** The file already explicitly revoked INSERT/UPDATE/DELETE from PUBLIC, anon and authenticated. The existing historical/live colour touch trigger already satisfies the prerequisite; no touch trigger was added. All five seed slugs were correct, so none were changed.

Updated only the Product Options test harness to use the repository-pinned PGlite runtime (with optional path override), load the real historical colour/touch DDL, test every RPC across the requested roles, add missing size reorder failures, verify colour and size version changes, verify unchanged legacy size compatibility, and persist test results. Added this report and its JSON result file.

`git diff --check` passed. Because the target SQL and test harness are currently untracked, they were also checked with `git diff --no-index --check` against NUL; no whitespace-error diagnostics. Git's no-index exit status 1 denotes the expected file additions, not a whitespace failure. Unrelated working-tree changes were left untouched.

## Execution boundary

No blocked checks: live read-only access was available for every requested hosted metadata/data check. The migration remains **unapplied on hosted Percent**, rechecked after local testing. No migration execution, db push, hosted write, or hosted test mutation occurred. `spacetees` was not accessed. No unrelated business logic was inspected or modified.

Stop here for manual execution by the user. Read-only observations describe the database at preflight time; later external changes may require repeating the checks.
