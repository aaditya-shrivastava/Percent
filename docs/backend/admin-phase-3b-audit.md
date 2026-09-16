# Percent Admin Phase 3B — architecture audit and blocker

Status: stopped at the explicit missing-audit-information gate. No Phase 3B migration or UI implementation has been made.

## Verified scope

Only Percent `gijyjdeohvdrnvqfqdha` was queried. The connector verified the project name, ap-south-1 region and ACTIVE_HEALTHY status. No hosted data, roles, schema, grants or migration history were modified.

Inspected hosted inventory columns, constraints, RLS, grants, available inventory functions and private guard/audit functions; inspected local generated types, Phase 3A service/model/detail, allocation RPC and Product Editor production summary.

## Existing support

`inventory_units` has id, product_id, variant_id, piece_number, sold_at, withdrawn_at, created_at and updated_at. Unique product/piece numbering and product/variant foreign keys protect physical identity. Sold and withdrawn cannot both be set. Deletion is prohibited, and sold/withdrawn pieces cannot be reused. Inserts are allowed only while draft. Archived inventory is protected.

Withdrawn pieces remain in the table and consume historical run capacity. Increase must therefore count every historical piece, including withdrawn and sold pieces. Decrease can select eligible unsold/unwithdrawn pieces deterministically by descending piece_number without deleting them. Existing triggers must not be weakened to allow new units on active designs.

The only matching public inventory mutation function is allocate_product_run. It accepts cumulative variant allocations, rejects reductions and history, and has no operation/reason/note inputs. It cannot perform the required adjustment workflow. A separate trusted atomic operation is needed after resolving the audit representation.

Authenticated users have SELECT only on inventory_units and inventory_adjustments, with admin_read policies calling private.is_admin(). Roles remain sourced from private.user_roles through authenticated identity. No browser table mutation permissions should be added.

## Exact audit blocker

inventory_adjustments currently contains only:

- id (one unit-event identifier)
- unit_id
- actor_id
- reason (text)
- old_state (nullable JSONB unit snapshot)
- new_state (JSONB unit snapshot)
- created_at

private.record_unit writes one event per affected physical piece. Its JSON values contain only inventory_units row fields. Existing immutable-history triggers reject updates/deletes.

There is no current representation for an optional internal note distinct from the reason, the requested INCREASE / DECREASE / SET_EXACT operation, or a shared identifier connecting multiple unit events into one logical adjustment. Per-operation before/after stock totals are also not recorded. A SET_EXACT operation has the same physical effects as an increase/decrease, so its original intent cannot be recovered from unit states. Timestamp/actor/reason grouping is not a reliable operation identifier.

The existing JSONB columns offer storage flexibility, but adding adjustment metadata to unit snapshots would establish a new audit contract and require an explicit design decision plus narrow trigger/RPC changes. This audit does not claim that new columns or tables are necessary. It also does not silently repurpose reason text or fabricate missing values.

The Phase 3B instructions state: “If the existing audit structure lacks one genuinely required field: STOP and report the exact blocker before proposing a schema change.” Work has stopped at that gate, before preparing a migration or implementing the UI.

## Additional semantics to preserve

The provided draft fixtures have zero public sellable availability, even when they have unsold/unwithdrawn physical pieces. Adjustment targets on those fixtures must be described as eligible physical stock; storefront availability stays lifecycle-gated. No test should publish a draft simply to make a sellable metric nonzero.

The Product Editor still labels limit minus sold as Run Remaining/Remaining, whereas Phase 3A Inventory correctly uses limit minus historically allocated. This existing display inconsistency should be corrected when Phase 3B frontend work resumes; no production quantities should be changed to reconcile it.

## Current changes and verification

Only this local audit report was added. New tables: 0. New columns: 0. New schemas: 0. No test units, withdrawals, users, sales or orders were created. No migration was deployed or repaired. Implementation tests/build/browser checks are not claimed because Phase 3B implementation has not begun.
