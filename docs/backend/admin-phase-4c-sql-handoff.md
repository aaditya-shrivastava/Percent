# PHASE 4C — BACKEND CHANGE REQUIRED

Audit date: 2026-09-16. The available Supabase project-list connector identified **Percent**, `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. Every hosted query was read-only and targeted that project alone. No SQL was executed on hosted Percent.

## Current architecture

Hosted `orders` has a unique required `order_reference`, nullable profile-linked `user_id`, integer-paise totals, and three separate constrained statuses. The defaults are `pending`, `unpaid`, and `unfulfilled`. The allowed values are:

| Dimension | Exact hosted values |
| --- | --- |
| Order | `pending`, `confirmed`, `cancelled`, `completed` |
| Payment | `unpaid`, `pending`, `paid`, `failed`, `partially_refunded`, `refunded` |
| Fulfillment | `unfulfilled`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `returned` |

`order_items` has immutable product name/slug, SKU, size, colour, image URL, quantity, unit-price and generated line-total snapshots. `order_addresses` has an immutable contact/delivery snapshot, unique by order and kind. `order_lifecycle_history` records Admin lifecycle changes, not order creation. `update_order_lifecycle` is an Admin-only trusted RPC; customer checkout must not call it.

`inventory_units` has one persistent row per physical piece and a unique `(product_id,piece_number)`. Its `sold_at` and `withdrawn_at` are permanent physical states, with product/variant integrity enforced by a composite foreign key. There is no reservation table, marker, key, index, or checkout/order-reference generation RPC. Existing RLS allows customer owner-scoped reads of orders/items/addresses and Admin reads of all; browser roles have no order/item/address write or inventory-unit update grant.

Hosted readback: **0 orders, 0 order items, 0 order addresses, 0 lifecycle events; 2 visible active products; 469 produced pieces, 463 physically eligible, 0 sold, 6 withdrawn; 0 coupons**. `addresses` supports owner-scoped saved addresses. The Checkout page currently builds a local temporary `PCT-*` reference, stores a demo confirmation, clears the cart, and displays unconnected Razorpay/Delhivery copy. My Orders is also demo/local data. These are frontend behaviors, not authoritative orders.

## Missing capability and smallest proposal

The schema cannot represent temporary ownership of exact unsold physical pieces or distinguish a retry from a second purchase attempt. The dedicated migration is [20260916090000_percent_checkout_reservation.sql](../../supabase/migrations/20260916090000_percent_checkout_reservation.sql). **Its complete SQL is in that file; run the entire file, including `begin` and `commit`, only in Percent's SQL Editor after review.** This document is the handoff, not authorization for an automatic deployment.

It proposes:

- **One** `public.checkout_reservations` table: order, order item, exact inventory unit, reservation/expiry timestamps, state and state-change timestamp. Historical expired rows are retained. A partial unique index permits only one `active` row per physical unit; indexes support order lookups and expiry maintenance. A private trigger prevents deletion, identity edits, premature expiry, and mismatched/ineligible piece links.
- **Two** nullable columns on existing `orders`: `checkout_key uuid` and `checkout_request jsonb`. A pair constraint and unique `(user_id,checkout_key)` index enforce owner-scoped idempotency. Existing pre-4C rows remain valid with both fields null. Reusing a key with a changed normalized cart/address is rejected; retrying an unchanged request returns the stored order, totals, and reservation state.
- **One** narrow authenticated `public.create_checkout_order(jsonb,uuid,uuid)` RPC, plus one private reservation TTL function (currently fifteen minutes) and one private integrity trigger function. The RPC derives the customer and verified email from Auth, requires their profile and an owned saved address, validates only variant IDs/quantities, locks current catalog rows, calculates paise totals from current variant prices, inserts an authoritative `PCT-` reference derived from the server UUID, creates snapshots, and reserves piece rows in the same transaction.

Coupon redemption is deferred: hosted coupons are empty and the Checkout promo control is demo-only. No coupon code is accepted by the proposed RPC and the discount is zero. The existing storefront and policy copy does not establish a live shipping tariff. The proposal explicitly uses **zero additional shipping and tax** for the foundation; prices are displayed tax-inclusive. This commercial assumption needs review before real acceptance checkout. No payment provider/reference, shipment, AWB, tracking event or `sold_at` is written. The returned order is `pending / unpaid / unfulfilled`.

## Security and concurrency

The reservation table has RLS enabled, no browser policy, and no `anon`/`authenticated` table grant. Piece IDs are returned neither to the browser nor in the RPC result. `anon` and `PUBLIC` cannot execute the new RPC. An authenticated user's Postgres role may invoke it, but the function uses `auth.uid()` exclusively and checks owned address/profile. It uses `SECURITY DEFINER`, an empty fixed search path, fully qualified application references, bounded cart shape and quantities, and no caller-supplied user, price, status, payment fact, or physical unit ID. Existing customer and Admin SELECT policies remain untouched.

Retries with the same owner/key serialize on a transaction-scoped advisory lock and the unique index. Separate orders select physical rows by ascending piece number with `FOR UPDATE OF u SKIP LOCKED`. The partial unique active-reservation index is the final database backstop against two active claims on one unit. An incomplete line raises an exception, rolling back the order, snapshots and all prior reservations. PostgreSQL documents row-level locking and `SKIP LOCKED` for queue-like selection in [SELECT](https://www.postgresql.org/docs/17/sql-select.html), and conditional uniqueness in [partial indexes](https://www.postgresql.org/docs/17/indexes-partial.html).

Availability is **physical eligible minus active, unexpired reservations**. The selector ignores an active row once `expires_at <= statement_timestamp()`, and while holding the piece row lock it moves that stale row to `expired` before inserting a new active row. A cron cleanup is not needed for correctness. Active rows are uniquely indexed without a volatile `now()` index predicate; expiry reclamation occurs on the trusted checkout write. Historical produced counts, `withdrawn_at`, `sold_at`, and the existing product run limit are unchanged. A cancelled order can retain its hold until TTL expiry; immediate release and payment conversion belong to the later trusted payment/reservation lifecycle, rather than bypassing Phase 4B.

## Verification and remaining gates

The proposed SQL parsed and the core function executed in PGlite against the complete current migration chain. [test-checkout-foundation.mjs](../../supabase/test-checkout-foundation.mjs) passed for anonymous denial, saved-address ownership, direct order/reservation write denial, exact-piece assignment, authoritative subtotal, unchanged-key replay, changed-key rejection, insufficient-stock transaction rollback, owner-scoped order reads, unpaid/unsold status, stale-row expiry/reclaim and retained history. The unique partial index and unit locks establish the concurrency design, but PGlite's single in-process connection is **not a true two-session race test**. Item/address/reservation injected-failure tests, real multi-session race, broader product-state matrix, responsive Checkout integration, and hosted positive acceptance are outstanding. They must be done after the manual SQL step; no fake hosted order will be inserted.

Structural impact if executed: **1 table, 2 columns on `orders`, 0 schemas, 1 public RPC, 2 private functions, 4 indexes (including the unique idempotency and active-unit indexes), 1 trigger, and the table/column integrity constraints shown in the SQL**. The migration does not create hosted order data or reservations by itself. Rolling back before any real checkout could drop the function/trigger/table/indexes and columns. Once real orders exist, dropping the table or checkout identity columns would destroy reservation and retry evidence; use a deliberate preservation/migration plan instead. Do not run blanket `db push` or `migration repair` as a substitute for executing this SQL.

**STOP at the database change gate.** After you execute the reviewed SQL manually in Percent → SQL Editor and report “SQL executed successfully,” Phase 4C can resume with hosted readback, frontend integration, meaningful concurrency and security checks, then a deliberate real checkout acceptance test. Do not begin Phase 4D or generate a fake hosted order.
