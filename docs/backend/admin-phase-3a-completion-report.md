# Percent Admin Phase 3A — completion report

Completed locally on 14 September 2026. Stopped before Phase 3B.

## Delivered

- `/admin/inventory`: real inventory dashboard, summary cards, product inventory table, mobile product cards, search, filters, sorting, separate allocation/sales progress and truthful zero states.
- `/admin/inventory/:id`: product and variant inventory detail with an allocation form for eligible drafts; fully allocated, archived or historically locked runs are read-only.
- Existing Admin shell and authenticated session plus `get_my_role()` route protection are preserved.
- The approved Inventory mockup informed the dark panels, table, summary cards and right-side allocation panel. Written scope takes precedence: no adjustment shortcuts, stock correction fields, editable production limits, restore, or history UI.

## Files

Added:
- `src/backend/admin/inventory-model.ts`
- `src/backend/admin/inventory.ts`
- `src/pages/admin/AdminInventory.tsx`
- `src/pages/admin/inventory.css`
- `scripts/test-admin-inventory.mjs`
- `supabase/test-product-allocation.mjs`
- `supabase/migrations/20260914055113_admin_production_allocation.sql`
- `docs/backend/admin-phase-3a-audit.md`
- This completion report.

Updated `src/pages/admin/AdminRoutes.tsx` and `src/backend/database.types.ts`. Production build output was regenerated. Earlier phase changes already present in the working tree were preserved.

## Existing architecture and database changes

Verified only Percent, `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. No unrelated project was accessed.

Existing `inventory_units` stores physical pieces with a product-specific unique piece number and variant reference. Sold/withdrawn states and historical immutability remain authoritative. Existing triggers enforce production serial limits, draft eligibility, immutable units and permanent archives. Partial allocation is permitted for drafts. Existing `inventory_adjustments` records each unit creation and authenticated actor; no history table was added. There is no reservation workflow in the inspected schema.

An atomic allocation RPC was absent. The dedicated migration was prepared locally and handed to the user. The user confirmed **“SQL executed successfully”** before implementation continued. Hosted verification confirmed the function body and execution privileges match the prepared migration. No migration was deployed through the connector.

**New tables: 0. New columns: 0. New schemas: 0.** The only new database capability is `public.allocate_product_run(uuid,jsonb,timestamptz)` with its grants. Existing audit triggers automatically record allocation writes.

## Allocation and concurrency

Inputs are cumulative per-variant totals. Every variant must appear once. The backend validates product ownership of variants, enabled status for increases, non-negative integer quantities and the combined total against that specific product's configured limit. Limits of 100, 250 and 1000 are supported; 100 is not a global cap.

The operation adds only missing physical pieces. It never reduces, moves, withdraws, sells or deletes existing units. Production limits, variant identity and sold counts are read-only in Inventory. Allocation does not publish a product.

The product row and variants are locked during the transaction. `expected_updated_at` is checked after the product lock. Stale requests receive PT409. The UI preserves unsaved values, provides Reload Latest / Stay on Page, blocks duplicate submission and reloads authoritative state after success. No optimistic inventory update is performed. Navigation and browser unload are protected while changes are unsaved.

## Metrics and filters

- Allocated: count of physical units, including historical sold/withdrawn units.
- Sold: units with a sold timestamp.
- Physical unsold/unwithdrawn: units with neither timestamp, shown in product detail.
- Available to sell: physical unsold/unwithdrawn units on enabled variants when the product is active and shop-enabled. Drafts correctly show zero.
- Run remaining: production limit minus allocated units, not limit minus sold.
- Awaiting allocation: draft designs with remaining capacity, including drafts that still need variants.

Separate progress indicators show allocation and sales. Derived allocation states are Not Allocated, Partially Allocated and Fully Allocated. Near-limit text appears at 90% allocation with remaining capacity. Lifecycle remains the stored backend status.

Search covers product name, slug, design code and variant SKU. Filters cover allocation, lifecycle (including sold-out derivation), and sellable availability. Low availability is a display-only rule: positive sellable stock at or below 10% of allocated units. Sorts cover name, newest, production limit, most/least allocated, lowest run remaining and most sold, with deterministic ID tie-breaking. No new status or threshold fields are stored.

The service uses bulk, paginated table reads rather than per-product inventory requests. Public product images render where available; private-only images currently use the existing neutral package placeholder on this inventory surface.

## Verification results

Passed:
- `node scripts/test-admin-inventory.mjs`: integer validation, 100/250/1000 limits, over-allocation, disabled variants, reduction rejection, lifecycle/history locks, SKU search and filters.
- `node supabase/test-product-allocation.mjs`: complete migration chain in isolated PGlite; admin/super_admin success; anon/customer/direct-write denial; partial/full allocations; combined cap enforcement; malformed/duplicate/foreign/missing variants; stale PT409; no-op; injected second-variant failure rolls back all physical units and audit entries.
- `node supabase/test-product-draft-rpc.mjs`: prior editor RPC regression suite, including allocation lock and archive denial.
- `node scripts/test-admin-foundation.mjs`: admin/super_admin guards; customer/null/unknown/no-session denial; identity mismatch, account switch and RPC failure; production and availability semantics.
- `npm run lint`.
- `npm run build`, including TypeScript project checking. Existing large JavaScript chunk warning remains; build succeeds.
- `git diff --check`; only existing line-ending warnings were emitted.

Hosted checks:
- Function definition and grants verified; anon cannot execute, authenticated may execute subject to the internal database role check.
- Authenticated caller with no mapped privileged role was rejected with 42501 using transaction-scoped test claims; no user or role record was created or changed.
- Backend over-allocation request for 100 + 151 against limit 250 rejected with 22023.
- Real permanent super-admin browser session loaded the dashboard before writes: 29 designs, 218 variants and zero allocated pieces.
- Browser over-allocation disabled Save Allocation and displayed the excess.
- Unsaved navigation opened the Stay / Discard dialog; Stay preserved values.
- Existing hidden verification draft saved 100 + 100 = 200, leaving 50 run remaining.
- A second browser session with the old version received the clean stale conflict and preserved its 100 / 150 inputs. No retry loop or overwrite occurred.
- The current session then saved 100 + 150 = 250. Reloading showed full allocation and read-only controls.
- SKU search and Fully Allocated filter each isolated the expected verification draft.

Authorization evidence is deliberately distinguished: live browser writes used the permanent super-admin session. Admin/customer-specific role tests were local; no temporary hosted users or owner-role transitions were performed in Phase 3A. The hosted no-role denial additionally exercised the installed role check.

## Responsive and accessibility checks

Dashboard and allocation detail were tested with viewport requests of 1440, 1280, 1024, 834, 768, 600, 425, 390, 375, 360 and 320 pixels. The browser rounded the 425 request to 426 CSS pixels; all other measured widths matched. No page-level horizontal overflow occurred. Allocation inputs stayed within the viewport. Desktop/tablet tables scroll within their container; mobile uses cards and a single-column allocation form. Desktop and 320px screenshots were visually inspected.

Inputs have labels and field-specific validation associations. Progress has numeric text and accessible names. Status is expressed in text. Focus styles remain visible. Native modal dialogs provide modal focus behavior, Escape handling, and return focus on close. Live allocation summaries, errors and save status are announced. This is targeted keyboard/DOM verification, not a full external accessibility audit.

## Test data and catalog safety

Only existing hidden verification product `f6b65a97-1f13-4b77-b760-7a944620f5e7` received inventory. Final state:

- Production limit: 250.
- Charcoal / S: 100 pieces.
- Charcoal / M: 150 pieces.
- Allocated: 250; sold: 0; sellable availability: 0; run remaining: 0.
- Lifecycle: draft; visible: false; shop available: false.
- 250 existing audit-table records were created by the normal trigger, all attributed to the permanent owner.

These verification units remain because physical inventory is immutable. They were not deleted or disguised as real production. Dashboard totals include this clearly named hidden verification draft.

All 27 real products remain unchanged and have zero physical inventory. Product-row checksum before and after: `a667cd18b5a6845247904f39ce716e07`. The permanent owner remains `super_admin`. No sales, orders, stock withdrawals or publication were created.

## Security advisors and limitations

The hosted security advisor reports:

1. Intentional authenticated SECURITY DEFINER execution for the allocation RPC. This is the approved narrow write entry point; it uses fixed empty search_path, schema-qualified references, auth.uid() and private.is_admin(), no dynamic SQL, and no public/anon execution. Existing direct table writes remain denied. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
2. Existing leaked-password protection disabled. No Auth setting was changed. [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No service-role credentials were added to frontend code, documentation, or environment examples. No stored quantity columns were added.

Manual migration-history reconciliation remains the user’s action, described below. Browser concurrency verification used two loaded versions and sequential competing saves; it was not a sustained multi-client load test. Bulk physical-unit reads are suitable for the current catalog but may need server-side aggregation at substantially larger inventory volumes. No frontend deployment outside the local production build was requested or performed.

## Manual migration-history reconciliation

Hosted history does not include local version `20260914055113`, because the SQL was executed manually. No history repair was run. The following instructions mark only this already-installed migration as applied; they do not rerun its SQL. Execute from the Percent repository and enter credentials only in your local terminal prompts:

```powershell
npx --yes supabase@2.75.0 link --project-ref gijyjdeohvdrnvqfqdha
```

Only after that succeeds and confirms Percent, inspect the local link:

```powershell
Get-Content supabase/.temp/project-ref
```

The output must be exactly `gijyjdeohvdrnvqfqdha`. Then:

```powershell
npx --yes supabase@2.75.0 migration repair 20260914055113 --status applied --linked
```

The CLI flags were verified using its official help. Do not run a blanket database push: older local/hosted migration version differences predate Phase 3A and require separate review.

## Stop point

Phase 3A is complete locally. Phase 3B stock adjustments/history, order deduction, checkout, payments, shipping integrations, production-limit changes and archive restoration were not implemented.
