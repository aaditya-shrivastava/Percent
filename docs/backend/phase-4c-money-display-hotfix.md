# Phase 4C money display hotfix

Date: 2026-09-21  
Project: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)

## Root cause

The catalog and cart product models expose display prices in rupees, and `formatInr` correctly formats those rupee values. The Phase 4C checkout response and persisted orders expose explicitly named integer paise values. Checkout's reservation summary and the new customer order mapping passed those paise values to the rupee formatter without dividing by 100. The result was a 100× display error.

The admin order formatter already divided paise by 100 and displayed the real order correctly. It was consolidated into the new shared paise formatter to prevent the customer and admin contracts from diverging.

## Hosted read-only verification

The Supabase connector was used only after its project inventory returned the single target Percent project in `ACTIVE_HEALTHY` state. The real acceptance order was inspected without mutation.

- Order reference: `PCT-DCF70ED46DA043F7BBBC2064E5CDE1CD`
- Product: Afterimage Tee
- Quantity: `1`
- Product price: `149900` paise
- Variant price: `149900` paise
- Item unit and line total: `149900` paise
- Order subtotal: `149900` paise
- Shipping, discount, and tax: `0` paise
- Order total: `149900` paise
- State: pending, unpaid, unfulfilled

The backend and hosted data are correct. No hosted data correction was required or performed.

## Code correction

- Added `formatInrFromPaise`, which accepts safe integer paise and converts only for rendering.
- Whole-rupee values omit decimals; fractional rupees render two decimal places.
- Checkout keeps preview/catalog values on the rupee formatter and uses the paise formatter only after an authoritative RPC result exists.
- Customer order DTO fields now state their unit explicitly: `unitPricePaise`, `subtotalPaise`, `discountPaise`, and `totalPaise`.
- My Orders and Order Details use the paise formatter throughout.
- Admin dashboard, product, order list, and order detail formatting now share the same paise formatter.
- The legacy Order Confirmation model remains a rupee-domain local snapshot, but its route redirects to real My Orders and is not used by Phase 4C checkout.

Corrected acceptance-order display:

- Line item: `₹1,499`
- Subtotal: `₹1,499`
- Shipping: `Free`
- Discount: `₹0`
- Total: `₹1,499`

## Verification

- Money contract: passed for 0, 100, 149900, 149950, and 10000000 paise.
- Complete authoritative order summary: passed.
- Checkout foundation, reservation, rollback, and idempotency: passed.
- Admin Orders RLS and order lifecycle: passed.
- TypeScript production build: passed.
- ESLint: passed.
- `git diff --check`: passed.

Database structural impact: none. New tables, columns, RPCs, and schemas: zero.

Phase 4D, Razorpay, payment transitions, and inventory sale remain untouched.

## Final reservation-state UI verification

The checkout result and Order Summary now consume the same state derived from the RPC's `reservation_active`, `reservation_expires_at`, and the current time:

- Active: `Inventory hold` / `Exact pieces reserved`; retry disabled.
- Expired or server-inactive: `Reservation expired` / `Pieces released back to inventory`; retry enabled.

Focused assertions cover active, elapsed-expiry, and server-inactive states. This change is presentation-only and does not modify payment, order, reservation, or inventory backend behavior.
