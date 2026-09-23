# Percent Admin Phase 4C completion report

Date: 2026-09-16  
Target: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
Status: Ready for the real customer checkout acceptance test

## Hosted readback

The Supabase connector project inventory was checked immediately before hosted reads. It returned only the target Percent project, in `ACTIVE_HEALTHY` state.

Read-only hosted checks confirmed:

- `public.checkout_reservations` exists with RLS enabled and no browser policies.
- `orders.checkout_key` and `orders.checkout_request` exist.
- `private.checkout_reservation_ttl()` and `private.checkout_shipping_paise(bigint)` exist.
- `private.guard_checkout_reservation()` and its trigger exist.
- `public.create_checkout_order(jsonb, uuid, uuid)` is a narrowly granted `SECURITY DEFINER` function with a fixed empty search path.
- `anon` and `public` cannot execute the checkout RPC; `authenticated` can.
- Reservation uniqueness, order, and active-expiry indexes exist.
- The shipping helper returns `0` for valid subtotals, matching the current free-shipping policy.
- Hosted orders, order items, reservations, addresses, and sold inventory counts were unchanged at zero during the structural verification. No hosted order was created.

The Supabase security advisor reports the reservation table as RLS-without-policies. This is intentional deny-by-default behavior because browser roles have no table privileges. It also reports authenticated access to the checkout `SECURITY DEFINER` RPC. That access is intentional: the RPC authenticates through `auth.uid()`, validates address ownership, recalculates all monetary and inventory facts, and exposes no arbitrary identifiers beyond cart variant IDs, an owned address ID, and the idempotency key.

## Repository implementation

- The local `20260916090000_percent_checkout_reservation.sql` migration mirrors the executed revision, including the centralized shipping helper.
- Checkout sends only variant IDs, integer quantities, the selected owned address ID, and a stable checkout-attempt UUID.
- Prices, subtotal, discount, shipping, tax, total, inventory units, customer ID, and payment state are never accepted from the browser as authority.
- Successful checkout presents a truthful pending, unpaid, unfulfilled reservation state and leaves the cart intact.
- Retry remains disabled until the returned reservation expires. A deliberate post-expiry retry resets the idempotency lifecycle.
- The old success-style order-confirmation route redirects to My Orders.
- My Orders, order details, account order count, and tracking views now read owner-scoped Supabase orders. Demo and local confirmation orders are no longer used.
- Checkout links to order details by the public order reference rather than the database UUID.
- Coupons are visibly unavailable and cannot alter totals.

## Reservation and security verification

The local full-migration-chain checkout suite proves:

- unauthenticated access and foreign-address use are denied;
- exact physical units are reserved and exact unit IDs are not returned;
- insufficient stock rolls back the complete order;
- identical retries return the same order;
- a changed request with the same key fails;
- expired reservations become non-blocking;
- reservations never set `sold_at`;
- browser reservation and arbitrary order writes are denied;
- subtotal, free shipping, zero discount/tax, and total are server-derived;
- the shipping helper exists, returns zero, and supplies stored `shipping_paise`;
- an idempotency key is isolated per authenticated owner.

The implementation uses row locks, `SKIP LOCKED`, an owner/key advisory transaction lock, an active-piece unique index, and an owner/key order unique index. A true hosted positive two-customer race was intentionally deferred because this task forbids fake production orders. The real acceptance test below supplies the first permitted hosted order; the local contention and rollback coverage passed.

## Quality results

- TypeScript and production build: passed.
- ESLint: passed.
- `git diff --check`: passed.
- Checkout foundation: passed.
- Admin Orders RLS: passed.
- Order lifecycle: passed.
- Product publication: passed.
- Product allocation and inventory adjustment regressions: passed.
- Product draft RPC and role/security regressions: passed.
- Browser smoke check: checkout loads correctly and shows the real empty-cart state without submitting an order.
- Checkout CSS has explicit desktop, tablet, mobile, and narrow-mobile layout boundaries at 1024, 900, 680, and 360 pixels, covering the requested viewport set without fixed-width page containers.

The production build retains the existing Vite advisory that the main JavaScript chunk is larger than 500 kB. It does not fail the build or affect the Phase 4C security contract.

## Real checkout acceptance test

1. Sign in as a real Percent customer.
2. Open a real active product, choose an available variant, and add one unit to Cart.
3. Open Checkout and select an address saved by that same account.
4. Select **Create Pending Order** once.
5. Confirm the page shows one order reference, `pending`, `unpaid`, `unfulfilled`, an active reservation expiry, and Shipping as Free / ₹0.
6. Confirm Cart still contains the item.
7. Open My Orders and confirm the same order and authoritative amount appear.
8. As the Percent administrator, open Admin Orders and confirm the same order appears there.
9. Confirm the reserved inventory count changed while `sold_at` remains unset.
10. Return to the checkout result or retry the same request and confirm no second order is created.
11. After the reservation expiry, confirm the UI says the pieces are no longer held and enables a fresh checkout attempt.

Phase 4D, Razorpay, Delhivery, payment success, fulfillment, and inventory sale remain unimplemented.
