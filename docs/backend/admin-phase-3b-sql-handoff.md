# Percent Phase 3B — manual SQL handoff

Status: prepared only; awaiting manual SQL execution. No Phase 3B UI or generated-type changes have been made. No hosted SQL was executed for this approval.

## Exact SQL

Run the entire file, including BEGIN and COMMIT:

`supabase/migrations/20260914105526_admin_inventory_adjustments.sql`

**RUN THIS ONLY IN: Percent → SQL Editor**

Confirm project reference `gijyjdeohvdrnvqfqdha`. The available connector verified Percent / ap-south-1 / ACTIVE_HEALTHY before preparation.

## Structural budget

- One new table: public.inventory_adjustment_operations.
- One new column on an existing table: public.inventory_adjustments.operation_id, nullable UUID, foreign key with DELETE RESTRICT.
- No new schemas or enums.
- One new public adjustment RPC; one existing private audit-trigger function extended.
- No historical event rows are rewritten. Existing allocation events retain a null operation_id.
- Installing the migration creates no products, physical units, withdrawals or logical adjustment data.

The parent table stores id, variant_id, actor_id, operation, reason, optional internal_note, before_quantity, after_quantity and created_at. Product identity is obtained through variant_id. Actor and variant foreign keys use RESTRICT to retain immutable references. Actor-account deletion will therefore require a separate deliberate history-retention decision; the application does not implement account deletion here.

Operation is TEXT constrained to INCREASE, DECREASE or SET_EXACT. The reason is separately constrained to the seven approved text values. Notes are nullable and limited to 2000 characters. Quantities are non-negative integers; direction constraints protect INCREASE/DECREASE. A no-change SET_EXACT is rejected rather than recorded as a successful adjustment.

Indexes support variant history ordered newest first with ID tie-breaking, actor foreign-key lookup, and non-null operation-to-unit-event lookup. No duplicate product_id column is added.

## Why required

allocate_product_run supports only cumulative allocation and rejects reductions. Existing unit audit rows cannot record SET_EXACT intent, distinct notes or reliable multi-piece grouping. The approved parent entity supplies those operation-level facts without modifying raw old_state/new_state snapshots or repurposing reason text.

## RPC contract and physical semantics

`public.adjust_variant_inventory(product_id uuid, variant_id uuid, operation text, quantity numeric, reason text, expected_updated_at timestamptz, internal_note text default null)`

The browser cannot supply actor IDs, audit IDs, operation IDs, timestamps, affected piece IDs or authoritative before/after values. Product/variant IDs are validated together. Expected timestamp is only a concurrency precondition; quantities are calculated from locked server state.

Numeric input is intentional: PostgreSQL can round fractional input when casting directly to integer. The RPC instead explicitly rejects fractional, negative, non-finite and oversized quantities before converting validated values. Increase/decrease require positive quantities; SET_EXACT permits zero when it actually reduces existing eligible stock.

Eligible physical stock means unsold AND unwithdrawn units, independent of storefront availability. Increasing requires an enabled variant on a draft, consistent with the existing guard. Decreasing may withdraw unsold/unwithdrawn pieces from a disabled variant or an active product when other history/lifecycle checks permit. Archived/completed runs are rejected. Variants with order-item history, or product-only order history that cannot be mapped safely to a variant, are conservatively locked because no piece-level reservation mapping exists.

INCREASE creates unused piece numbers in ascending order. Historical produced counts every unit, including sold and withdrawn pieces. Total historical production cannot exceed the configured design limit. DECREASE withdraws highest eligible piece numbers first without deleting units. SET_EXACT computes a signed delta and follows the same physical rules while recording SET_EXACT as its logical operation. It never restores old units or changes sold counts, production limits or publication state.

## Atomicity and association

The RPC locks the product, then the variant, then physical unit rows. Product version is checked under the lock; stale calls raise PT409. Successful adjustments update the shared product version used by Phase 3A and the Product Editor.

The server generates one operation UUID, inserts one immutable parent row with server-calculated before/target quantities, and sets `percent.inventory_operation` with transaction-local set_config. The existing record_unit trigger reads that context, verifies the parent matches auth.uid(), the variant and transaction timestamp, then writes the unchanged raw unit snapshots plus operation_id. All affected unit events use that parent ID. Parent reason is copied to unit events; internal_note stays only in the protected parent table.

The RPC restores the previous transaction-local context and verifies the actual resulting physical count, affected-piece count and associated audit-event count before returning. Failure raises an exception and rolls back parent, units and events together. Existing allocation events outside adjustment context remain unassociated. Existing sold-out/archive behavior in record_unit is preserved.

## RLS, grants and immutability

The new table has RLS enabled with the existing admin_read convention using private.is_admin(). PUBLIC, anon, authenticated and service_role grants are explicitly revoked, then authenticated receives SELECT only. Customers see no rows through RLS. No direct browser writes are granted on any inventory table.

The RPC narrowly uses SECURITY DEFINER because direct inventory writes must remain unavailable to browser roles. It uses an empty fixed search_path, qualified application objects, no dynamic SQL, auth.uid() and private.is_admin() on every call. PUBLIC/anon/service_role execution is revoked; only authenticated receives execution, subject to the internal role check. There are no role mutation capabilities or frontend privileged credentials.

The new parent reuses private.immutable_snapshot() to reject UPDATE/DELETE. Existing unit-event immutability remains in force. The modified trigger function has no direct application execution grant.

## Rollback implications

The migration is wrapped in a transaction: an execution error should leave its changes unapplied. Do not rerun blindly if execution status is uncertain; inspect the hosted schema first.

Before any adjustment data exists, a deliberate reversal would restore the previous record_unit definition, remove the new RPC, remove the association column/index, and remove the empty parent table and its associated policy/indexes/trigger. No rollback SQL is executed or bundled into the migration.

After adjustments exist, dropping the parent/link would destroy the audit relation and must not be used as a normal rollback. Disable the RPC's authenticated execution instead while preserving all operations, events and physical states. Withdrawals cannot be undone by resetting withdrawn_at; that would violate the existing immutable-unit rule. A function rollback cannot reverse physical production or withdrawals.

## Validation status and next step

Preparation included static review against the previously verified hosted schema, trigger definitions and privilege model. In accordance with “Prepare the migration and exact SQL only” / “DO NOT execute SQL,” this migration has not been executed against either hosted or local databases. Runtime tests, security advisors, generated types, history reader, UI and responsive checks remain pending after manual confirmation.

After execution, reply **SQL executed successfully**, or provide the SQL error. Only then will hosted verification and implementation continue. The Product Editor remaining-capacity display fix will be made during that frontend work, with no quantity changes.

The single migration version for later manual history reconciliation is `20260914105526`. Do not run db push or automatic history repair. After confirming hosted installation and the linked project, the targeted manual command is:

```powershell
npx --yes supabase@2.75.0 migration repair 20260914105526 --status applied --linked
```

Use it only when the local link is verified as `gijyjdeohvdrnvqfqdha` and that version is absent from hosted migration history. It is not part of SQL installation and has not been run.
