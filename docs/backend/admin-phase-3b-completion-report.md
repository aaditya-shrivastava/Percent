# PERCENT ADMIN PHASE 3B — COMPLETE

Completed locally on 14 September 2026. Hosted verification was restricted to Percent (`gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY). No other project was accessed. Phase 4 Orders has not begun.

## 1. Hosted SQL verification

After the user's manual SQL confirmation, the available Supabase connector verified the target project and inspected the installed table, column, RPC, trigger function, RLS and grants against `20260914105526_admin_inventory_adjustments.sql`. The migration was not rerun or deployed by the agent. Generated TypeScript database types were refreshed from the hosted schema.

## 2. Adjustment RPC

`public.adjust_variant_inventory` is the only adjustment write path. It derives the actor from `auth.uid()`, checks the existing private admin role, validates product/variant identity, and calculates authoritative quantities under database locks. Its narrowly scoped SECURITY DEFINER implementation uses a fixed empty search path and qualified application objects. No browser credentials with elevated privileges or direct inventory writes were introduced.

## 3–6. Physical behavior and production limits

| Operation | Verified behavior |
| --- | --- |
| Increase | Creates new physical units with unused piece numbers; requires an enabled draft variant and sufficient historical run capacity. |
| Decrease | Withdraws eligible unsold/unwithdrawn units, highest piece numbers first. Never deletes units or changes sold units. |
| Set Exact | Targets eligible physical quantity. Uses increase/decrease semantics while retaining `SET_EXACT` in logical history. A no-change target is rejected. |
| Production limit | Uses each product's configured limit. Historical production includes unsold, sold and withdrawn units. Withdrawals never reopen capacity or restore old units. |

Archived/completed designs remain locked permanently. Relevant order history conservatively blocks adjustments; the UI blocks products with order history. No reservation or order workflow was added.

## 7–8. Immutable audit and per-unit linkage

Each successful adjustment creates one server-owned logical operation with actor, intent, reason, optional note and before/after quantities. Every affected unit event references that operation through `operation_id`; existing raw old/new snapshots remain intact. Parent and child events commit atomically with physical changes. Existing allocation events retain null operation IDs and are not relabeled as manual adjustments.

Hosted checks confirmed four logical operations and 13 associated unit events, with matching actors and event counts equal to the absolute quantity changes. Local injected insert and withdrawal failures verified complete rollback of units, parent operations and audit events. History update/delete and direct browser inventory mutations remain denied.

## 9–10. Adjustment and history UI

`/admin/inventory/:id` now includes an accessible Adjust Stock dialog with product, variant, SKU, color/size, limit, historically produced, sold, withdrawn, eligible physical stock and run remaining. It supports all three operations, a mandatory controlled reason, optional internal note (maximum 2,000 characters), and live before/after previews.

Inventory History shows date, variant/SKU, logical operation, signed change, before/after, reason and actor. Details expose the note and operation ID. It is read-only, newest first, with variant/operation filters and bounded 25-row pages. Actor identity is the immutable Auth UUID; the displayed name comes from the current linked profile, with UUID fallback. It is not a historical name snapshot.

## 11. Concurrency and form safety

The RPC locks shared product state and checks `expected_updated_at`, raising `PT409` for stale requests. The browser displays “Inventory was updated elsewhere” with Reload Latest and Stay on Page. A stale browser test preserved entered fields, disabled saving until reload, and did not automatically retry. Dirty close/reload/navigation protection and duplicate-submit prevention are implemented. Successful writes refetch authoritative state rather than changing stock optimistically.

## 12. Product Editor correction

The Production tab and sidebar now derive Run Remaining from `production_limit - historically produced/allocated`, rather than limit minus sold. Browser verification showed limit 20, produced 18, sold 0 and Run Remaining 2. This was a display correction; no production limit or product data was changed for it.

## 13. Authorization results

Hosted inspection confirmed authenticated RPC execution with internal role enforcement, no anonymous execution, admin-only history RLS, and SELECT-only browser access to the logical audit table. The permanent administrator's existing browser session successfully exercised the workflow; its role remains `super_admin`.

The complete migration chain was tested locally with anonymous, customer, admin and super_admin identities: anonymous/customer writes were denied, customer history returned no rows, and admin/super_admin adjustments succeeded. These role-boundary tests were local database tests; no hosted role transitions or temporary Auth users were used in Phase 3B.

Supabase security advisors reported the intentional authenticated SECURITY DEFINER RPC pattern for allocation/adjustment and the existing disabled leaked-password protection setting. No unexpected RLS finding required a schema change. These findings were not automatically changed.

## 14–15. Verification data and catalog safety

Only one newly authorized hidden draft was used for Phase 3B physical writes:

- Product: `[Verification] Inventory Adjustment`
- Product ID: `ae4b81a3-e22e-41cf-9a77-6251d1b42ec0`
- Variant ID: `f67c7e01-83b1-4144-ac65-d06c2024dc7a`
- SKU: `VERIFY-INVENTORY-ADJUSTMENT-S`
- Final state: draft, not visible, not in shop; limit 20, historical produced 18, eligible physical stock 13, withdrawn 5, sold 0, run remaining 2.

| Verification step | Before → after eligible stock | Linked events |
| --- | --- | --- |
| Existing Phase 3A baseline allocation | 0 → 10 | 10 legacy allocation events, no logical operation |
| Increase | 10 → 15 | 5 |
| Decrease | 15 → 12 | 3 |
| Set Exact down | 12 → 10 | 2 |
| Set Exact up | 10 → 13 | 3 |

Hosted over-limit increase and impossible upward Set Exact requests were rejected without committed changes. Verification units and immutable history were retained; none were deleted or restored. Earlier verification products were untouched.

All **27 real catalog products remain unchanged**, with zero inventory. Before/after real-product row checksum matched: `a667cd18b5a6845247904f39ce716e07`. The catalog now contains 30 products including three verification drafts. No orders, sales, publication, payments or shipping were created.

## 16. Responsive and accessibility checks

Authenticated browser checks covered requested widths 1440, 1280, 1024, 834, 768, 600, 425, 390, 375, 360 and 320 pixels. The browser rounded the requested 425 width to 426; all other observed widths matched. Dialogs stayed within the viewport, fields did not overflow, and wide history content scrolled inside its container without page overflow. Mobile screenshots were visually inspected.

The dialog has an accessible name, labeled inputs, native modal behavior, Escape/close handling and dirty-form protection. A focus-return issue found during testing was fixed and rechecked: closing the dialog returns keyboard focus to the originating Adjust Stock button.

## 17. Validation

All passed:

- `node scripts/test-inventory-adjustments.mjs`
- `node supabase/test-inventory-adjustments.mjs`
- `node supabase/test-product-allocation.mjs`
- `node supabase/test-product-draft-rpc.mjs`
- `node scripts/test-product-editor.mjs`
- `node scripts/test-admin-inventory.mjs`
- `npm run lint`
- `npm run build` (includes `tsc -b`)
- `git diff --check`

Coverage includes quantity/reason validation, cap enforcement after withdrawals, sold-unit protection, immutable history, atomic rollback, stale conflicts, logical linkage, Phase 3A and Product Editor regressions. History pagination was tested locally with 27 operations (25 + 2 distinct rows); the hosted fixture has four operations. Lint and production build were repeated successfully after the final focus fix. The build retains the existing non-failing warning about a JavaScript chunk over 500 kB. Git reports existing LF/CRLF conversion warnings, not whitespace errors.

## 18. Database changes, separately reported

Only the already approved, manually installed Phase 3B extension:

| Structure | Change |
| --- | --- |
| New tables | **1** — `public.inventory_adjustment_operations` |
| New columns on existing tables | **1** — nullable `public.inventory_adjustments.operation_id` |
| New schemas | **0** |
| Functions | One new adjustment RPC; narrow extension to existing private unit-audit trigger function |

Associated constraints, indexes, RLS, grants and immutability trigger are part of that approved extension. No further database structures, role changes or privileged frontend endpoints were added during completion.

## 19. Manual migration-history reconciliation

Hosted structure is installed, but version `20260914105526` was absent from migration history at the final check. No automatic repair or `db push` was run. After independently confirming the local CLI link is exactly Percent `gijyjdeohvdrnvqfqdha`, the targeted manual reconciliation command is:

```powershell
npx --yes supabase@2.75.0 migration repair 20260914105526 --status applied --linked
```

This records an already installed migration; do not rerun its SQL. The command remains a manual bookkeeping step for the user.

## 20. Remaining limits and stop point

Frontend implementation and production build are complete locally; no external frontend deployment was requested. Hosted multi-role impersonation and a hosted 26+ operation pagination seed were deliberately unnecessary: role and pagination boundaries were covered locally, while real authenticated super_admin behavior was verified in the browser. Immutable actor references use restrictive foreign keys, so future account deletion requires a separate history-retention decision.

The manual migration-history step above and existing advisor/build warnings are documented, not hidden. No Phase 4 Orders, checkout, payment, shipping, restore or deletion work was started.
