# Percent Admin Orders Crash Hotfix Report

Date: 21 September 2026  
Project: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
Status: **ADMIN ORDERS CRASH — FIXED AND VERIFIED**

The unrelated `spacetees` project was not accessed. Phase 7 was not started.

## Root cause

The explicit Supabase select embedded relationships under `order_items` and `order_addresses`. The frontend then cast that unnormalized result to `AdminOrder`, whose contract expects `items` and `addresses`. TypeScript could not detect the mismatch because of the `as unknown as AdminOrder` cast. `shippingAddress()` consequently called `.find()` on undefined, and item helpers had the same latent risk.

## Query and model correction

`src/backend/admin/orders.ts` now uses explicit stable aliases:

`*,items:order_items(*),addresses:order_addresses(*)`

Both list and detail reads pass through the same normalization boundary in `src/backend/admin/order-model.ts`. It accepts the canonical aliases and the former raw relation names, filters malformed collection entries, and always produces array-valued `items` and `addresses`. Invalid top-level order rows become a controlled query failure and render the existing Percent Admin retry state instead of reaching the UI.

`shippingAddress()`, `orderCustomer()`, and `orderItemCount()` also handle missing or null collections safely. A missing shipping snapshot returns `null`, and the detail page truthfully displays “Shipping address unavailable.” No address is fabricated.

## Snapshot behavior

Customer identity and delivery data come only from immutable `public.order_addresses` order snapshots. `public.addresses` is not selected or used as a fallback. A regression test explicitly supplies a differing current saved address and confirms that the order snapshot wins.

## Hosted read-only verification

The verified Percent project contains two Phase 4C orders. Both have one `order_items` row and one shipping `order_addresses` row. `/admin/orders` rendered both real records, and both detail routes rendered successfully with:

- the stored customer/contact snapshot
- the stored shipping address
- the stored product line and quantity
- ₹1,499 totals
- order, payment, and fulfillment states
- lifecycle actions and history

Browser console errors: 0. Hosted mutations: 0.

## Files changed

- `src/backend/admin/order-model.ts`
- `src/backend/admin/orders.ts`
- `src/pages/admin/AdminOrderDetail.tsx`
- `supabase/test-admin-order-model.mjs`
- `docs/backend/admin-orders-crash-hotfix.md`

## Verification

- Admin Order model regression test: PASS
- Admin Orders RLS test: PASS
- Phase 4B lifecycle test: PASS
- Hosted list with two real orders: PASS
- Hosted detail for each real order: PASS
- Snapshot-over-saved-address behavior: PASS
- INR/paise formatting: PASS
- ESLint: PASS
- TypeScript: PASS
- Production build: PASS
- `git diff --check`: PASS

The build retains Vite's existing advisory for a JavaScript chunk larger than 500 kB; the build completes successfully.

## Database impact

- New tables: 0
- New columns: 0
- New RPCs: 0
- New migrations: 0
- Hosted data changes: 0