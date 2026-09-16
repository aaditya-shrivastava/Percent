# Percent Admin Phase 4A — order architecture audit

Audit date: 14 September 2026.

Target verified with the available Supabase project listing and project detail capability: **Percent**, `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. The unrelated project was not accessed.

## Finding

Phase 4A has no database blocker and requires no SQL. The existing exposed `public` schema contains the authoritative order structures needed by a read-only Admin Orders experience:

- `orders`: human-readable `order_reference`; customer profile link; order, payment and fulfillment statuses; INR monetary snapshots; coupon snapshot; nullable provider/reference/tracking fields; delivery and created/updated timestamps.
- `order_items`: immutable purchase-time product name, slug, SKU, size, colour, image URL, quantity, unit price and generated line total, with nullable current-catalog references.
- `order_addresses`: shipping/billing order-time contact and address snapshots, unique per order and kind.

There are no payment, shipment, fulfillment-event or order-status-history tables and no order RPCs. The nullable payment/shipping columns are the only current integration surface. A timeline must therefore show only explicitly stored creation and delivery timestamps.

All three tables have RLS enabled. `authenticated` has SELECT only. Each has an `admin_read` policy through the existing `private.is_admin()` role check and an owner-scoped customer policy. Anonymous has no table grant. No browser insert, update or delete permission exists. This supports direct authenticated relational reads without a SECURITY DEFINER read function.

Hosted counts at audit time:

- orders: 0
- order items: 0
- order addresses: 0

The storefront checkout is a frontend preview. It saves an optional checkout address to localStorage and one confirmation snapshot to sessionStorage, generates a temporary `PCT-*` reference, and displays simulated Razorpay/Delhivery copy. It does not create a database order, payment, shipment, reservation or inventory deduction. Customer order pages remain outside Phase 4A.

## Decision

Implement Phase 4A with existing relational reads, 25-row pagination, bulk search over order references and address snapshots, and no order mutations. No migration, view, table, column, schema, read RPC or write RPC is necessary.

Expected and final Phase 4A structural impact:

- New tables: 0
- New columns: 0
- New schemas: 0
- New database functions: 0
- New order write RPCs: 0

