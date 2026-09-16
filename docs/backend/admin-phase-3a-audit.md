# Admin Phase 3A — audit and manual SQL handoff

Status: SQL prepared and locally tested; awaiting user execution. Phase 3A UI is not implemented or claimed complete.

## Verified target and existing architecture

Percent: `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. Verified using the available Supabase project capability. Hosted audit was read-only. No unrelated project was accessed.

The hosted catalog contains 27 real draft products plus two existing verification drafts (29 total), 218 variants, and zero inventory units. No real catalog records were modified.

Existing `inventory_units` represents physical pieces, unique by product and piece number. It links each piece to a variant and records sold/withdrawn timestamps. Existing immutable `inventory_adjustments` records unit changes with the authenticated actor. No reservation mechanism exists in the inspected schema. Authenticated administrators have SELECT access to inventory through existing RLS; direct inventory writes are not granted. No atomic allocation RPC was present.

Existing triggers lock the product row, enforce each product's configured production limit, prohibit physical-unit deletion, preserve sold/withdrawn history, and prohibit archive restoration. Partial allocation is permitted while draft; non-draft designs require a complete run. The product editor already prevents changing production limits after allocation.

## Exact proposed SQL

`supabase/migrations/20260914055113_admin_production_allocation.sql`

Run the entire file, including BEGIN and COMMIT, only after confirming the SQL Editor belongs to Percent (`gijyjdeohvdrnvqfqdha`).

**RUN THIS ONLY IN: Percent → SQL Editor**

This adds one function, `public.allocate_product_run(product_id uuid, allocations jsonb, expected_updated_at timestamptz)`, and its execution grants. New tables: 0. New columns: 0. New schemas: 0. It creates no inventory merely by installing the function.

Input is a complete array of existing variant IDs and cumulative allocation quantities. Only eligible drafts may receive additions. The function rejects reductions, duplicate/foreign/missing variants, malformed quantities, increased allocation for disabled variants, sale/withdrawal/order history, archived products, stale versions, and totals exceeding the design-specific limit. It never changes production limits or publication state. It inserts only missing pieces and uses existing audit triggers.

All validation and writes occur in one transaction. Product and variant row locks serialize allocations. The current product timestamp is checked after obtaining the product lock; stale requests return PT409, preserving the existing clean HTTP conflict convention. No-op requests add nothing. Run remaining equals production limit minus total allocated pieces.

## Security and permissions

The narrowly scoped SECURITY DEFINER function is necessary because authenticated clients cannot directly insert physical units. It requires a non-null auth.uid() and existing private.is_admin() authorization on every invocation. Referenced application objects are schema-qualified; search_path is fixed to an empty string. There is no dynamic SQL, arbitrary identifier input, private-schema exposure, role assignment, or browser service credential.

Default PUBLIC execution and execution for anon/authenticated/service_role are revoked, then EXECUTE is granted only to authenticated. Customer calls still fail the internal role check. Existing table grants and RLS remain unchanged. Existing audit triggers preserve auth.uid() as the actor.

## Local verification

Passed `node supabase/test-product-allocation.mjs` against the complete migration chain in isolated PGlite: admin/super_admin success; anon/customer/direct-write denial; configured 250/1000 limits and combined over-allocation rejection; partial/full allocation; invalid inputs; reduction denial; no-op saves; stale PT409; injected second-variant failure rolling back all units and audit entries; execution grants.

Passed `node supabase/test-product-draft-rpc.mjs` regression suite and `git diff --check` (existing line-ending warnings only).

These are local database tests, not hosted HTTP concurrency or browser verification. No hosted test users, role transitions, units, or allocations were created. Hosted permissions, actual concurrent requests, browser behavior, responsive layout, lint/typecheck/build and the inventory UI remain for continuation after manual SQL confirmation.

## Rollback implications

Before any allocation, removing this function removes the new capability without touching data:

```sql
DROP FUNCTION public.allocate_product_run(uuid, jsonb, timestamptz);
```

After allocations have been made, dropping the function does not reverse physical pieces or audit history. Existing append-only inventory rules remain in force; do not delete those records to undo allocation.

No migration history was repaired or modified. After manual execution confirmation, compare hosted function definition and migration history before proposing any necessary targeted history reconciliation. Do not run a blanket migration push.

## Continuation gate

The adopted Phase 3A instructions explicitly require preparing the migration and stopping for manual execution. Reply `SQL executed successfully`, or provide the SQL error, before hosted verification and UI implementation continue.

The future inventory dashboard will distinguish unsold/unwithdrawn physical pieces from publicly sellable availability (draft pieces are not sellable). It will use the approved inventory mockup while omitting stock adjustment shortcuts, editable production limits, restore, and Phase 3B history controls as required by the written scope.

## Handoff resolved
User confirmed manual SQL execution. Hosted function and grants were verified and Phase 3A implementation completed. See admin-phase-3a-completion-report.md for final results; the earlier pending status above records the original SQL handoff.
