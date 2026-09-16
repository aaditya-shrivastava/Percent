# PERCENT ADMIN PHASE 4A — COMPLETE

Completed locally on 14 September 2026. Hosted inspection and browser reads were restricted to Percent (`gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY). Phase 4B has not begun.

## Architecture and hosted state

The authoritative model is the existing `orders`, `order_items` and `order_addresses` set. Orders store the human-readable reference, three constrained status dimensions, INR pricing totals, coupon snapshot and nullable payment/shipping integration fields. Items and addresses preserve purchase-time snapshots. Current catalog IDs are references rather than the source for historical names, variants or prices.

There is no separate payment, shipment or status-history table. The detail timeline shows only explicit `created_at` and `delivered_at` events. It does not infer events from current statuses.

The hosted database contains **0 orders, 0 order items and 0 order addresses**. The dashboard therefore shows zero metrics and a designed empty state. No revenue metric is shown because there are no authoritative paid orders.

The storefront checkout remains local/demo-only: optional address data is stored on the device, the latest confirmation is stored per browser session, and a temporary reference is generated in the frontend. Its payment and shipping presentation is simulated and was not imported into Supabase.

## Database decision and security

No SQL was required. Existing RLS provides admin/super_admin reads through `private.is_admin()` while customer reads remain owner-scoped. Anonymous has no SELECT grant. The browser has no order INSERT, UPDATE or DELETE grants. The implementation uses the authenticated publishable client and does not include a service key.

Local migration-chain tests verified:

- super_admin and admin can read all order, item and address records;
- an owning customer can read its own order snapshots;
- an unrelated customer cannot read them;
- anonymous cannot read the order tables;
- browser roles cannot write order records.

The existing route guard denies customer/null/unauthenticated Admin access, while backend RLS remains authoritative. The permanent super_admin session successfully loaded both Phase 4A routes without a role change.

Security advisors were rerun. They reported only the two previously approved authenticated SECURITY DEFINER inventory functions and the existing disabled leaked-password protection setting. Phase 4A introduced no function or policy finding. Reference: [Supabase SECURITY DEFINER advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Routes and behavior

`/admin/orders` now provides:

- truthful Total, Open, Paid and Fulfilled metrics;
- search by order reference, order-time customer name, email or phone;
- real order, payment and fulfillment status filters;
- newest, oldest, highest-total and lowest-total sorting;
- bounded 25-row pages with exact counts and accessible controls;
- desktop table and mobile cards;
- loading, retry, empty and no-match states;
- no Create Order or lifecycle actions.

Search uses four bounded, parameterized field queries followed by one relational order read. It does not interpolate user input into raw PostgREST filter grammar and does not issue per-order customer/item/address queries.

`/admin/orders/:id` now provides a read-only header, order-time customer details, delivery snapshot, item snapshots, stored pricing breakdown, coupon code, truthful payment and shipping states, and the explicit-event timeline. Invalid UUIDs return the local not-found state without querying; missing valid records also return not found. Images use the stored item snapshot URL when present and degrade to a neutral placeholder.

No customer/address editor, status action, cancellation, refund, payment marking, shipment action, reservation or inventory mutation is present.

## Files added and changed

Added:

- `src/backend/admin/order-model.ts`
- `src/backend/admin/orders.ts`
- `src/pages/admin/AdminOrders.tsx`
- `src/pages/admin/AdminOrderDetail.tsx`
- `src/pages/admin/orders.css`
- `scripts/test-admin-orders.mjs`
- `supabase/test-admin-orders.mjs`
- `docs/backend/admin-phase-4a-audit.md`
- `docs/backend/admin-phase-4a-completion-report.md`

Changed:

- `src/pages/admin/AdminRoutes.tsx`
- generated `dist` output from the production build

## Verification

Passed:

- Admin order model, money, mapping, validation and page-size tests;
- complete local migration-chain order RLS/privacy tests;
- Phase 3 inventory model regression;
- Phase 3 inventory adjustment and RLS regression;
- TypeScript via `tsc -b`;
- ESLint;
- Vite production build;
- `git diff --check` (only existing LF/CRLF conversion notices).

Authenticated browser checks confirmed the real hosted zero-state, filtered no-match state, invalid-order state, semantic headings, labeled search/filters, readable status text and accessible pagination. Responsive checks covered 1440, 1280, 1024, 834, 768, 600, 425, 390, 375, 360 and 320 px. The browser represented 425 px as 426 px. No page-level horizontal overflow occurred. Filters collapse from four to two columns and then one; populated desktop uses a contained table, mobile uses cards, and the detail grid stacks to one column.

Production contains no orders, so populated dashboard/detail rendering was verified with typed local model and database fixtures rather than fake hosted orders. No production order, customer, payment or shipment fixture was created.

The production build retains the existing non-failing warning for a JavaScript chunk above 500 kB.

## Hosted safety and database impact

Final hosted readback showed 0 orders, 0 order items and 0 order addresses. Phase 4A performed only SELECT queries and authenticated page reads. It did not create or change orders, payments, shipments, inventory units, products, customers, roles or publication state.

Database structural changes:

- New tables: **0**
- New columns: **0**
- New schemas: **0**
- New read RPCs: **0**
- New write RPCs: **0**

There is no Phase 4A migration and no migration-history reconciliation command.

## Remaining limitations and stop point

Payment capture, fulfillment integration, richer status history and real customer order creation do not exist yet. The UI represents those absences plainly. Item image URLs are stored snapshots, but image availability can still change at the remote object location. Search is bounded at 500 matching IDs per field; this is sufficient for the current empty store and avoids unlimited reads, but a future high-volume order system may warrant a dedicated indexed search service.

No status mutation, cancellation, refund, reservation, inventory deduction, Razorpay, Delhivery or checkout/order creation work was started. Phase 4A stops here before Phase 4B.
