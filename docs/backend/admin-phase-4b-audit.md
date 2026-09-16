# Percent Admin Phase 4B — database audit and SQL gate

Date: 2026-09-15. Target verified through the available Supabase connector: Percent, `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. All hosted queries were read-only and targeted this ref.

## Existing order contract

`public.orders` stores three independent, constrained text fields:

- Order: `pending`, `confirmed`, `cancelled`, `completed`.
- Payment: `unpaid`, `pending`, `paid`, `failed`, `partially_refunded`, `refunded`.
- Fulfillment: `unfulfilled`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `returned`.

The order also has `created_at`, `updated_at`, nullable `delivered_at`, nullable payment provider/reference, nullable shipping provider/tracking/estimate, and stored INR totals. There is no cancellation reason field and no status-history table. The `order_items` and `order_addresses` tables preserve immutable purchase-time snapshots.

`orders` has RLS enabled. `authenticated` can SELECT but cannot INSERT or UPDATE; `anon` cannot SELECT. Two SELECT policies cover admin read through `private.is_admin()` and owner read through `auth.uid()`. The existing `touch_updated_at` and `audit_change` triggers are enabled. No order lifecycle RPC exists.

`private.audit_logs` records actor, table, operation, row ID and time, but does not store the previous/new status, reason or note. It cannot reconstruct a truthful immutable lifecycle. `updated_at` and `delivered_at` also cannot represent all transitions. Phase 4A's timeline is deliberately limited to explicit creation and delivery timestamps.

Customer My Orders and tracking pages are currently frontend preview data; no real checkout or order creation exists. Razorpay, Delhivery, payment evidence, shipping events, reservation and stock deduction are absent. Hosted orders/items/addresses remain zero at audit time.

## Decision

The existing model cannot fulfill validated transitions, actor identity, optional internal note, immutable old/new history, and stale-write protection without SQL. The minimum addition is one narrow `public.order_lifecycle_history` table and one `public.update_order_lifecycle` RPC. No new column or schema is needed. Payment-status mutation stays unavailable.

Proposed Admin transition map:

| Dimension | Current | Next | Requirement |
| --- | --- | --- | --- |
| Order | pending | confirmed | Internal acceptance |
| Order | pending or confirmed | cancelled | Reason; unpaid/failed; unfulfilled/processing; no shipping reference |
| Order | confirmed | completed | Existing trusted payment provider/reference and delivery provider/tracking/timestamp |
| Fulfillment | unfulfilled | processing | Order confirmed; internal preparation only |

Cancellation atomically changes the separate fulfillment status to `cancelled`, with a second history row. `cancelled` and `completed` are final. No Admin transition to `shipped`, `out_for_delivery`, `delivered`, `returned`, `paid`, or any refund value is exposed. This uses only values actually present in the schema.

The proposed RPC derives the actor from `auth.uid()`, authorizes via `private.is_admin()`, locks the order, compares `updated_at` and returns PT409 on staleness, validates the explicit transition, updates only the order/fulfillment fields, and writes history in the same transaction. No inventory, payment integration or shipping record is mutated.

The history table has RLS and an admin-only SELECT policy. Browser roles have no INSERT/UPDATE/DELETE grant; an immutable trigger blocks UPDATE/DELETE even for privileged ordinary operations. The RPC has a fixed empty search path, fully qualified references, and execution granted only to `authenticated`. Its authorization remains internal, so a customer with the authenticated Postgres role is denied.

The migration is [20260915130509_admin_order_lifecycle.sql](../../supabase/migrations/20260915130509_admin_order_lifecycle.sql). It was created locally with the Supabase CLI and passed local migration-chain parsing. **It has not been executed on the hosted project.** The Phase 4B instruction requires manual SQL execution and a stop before UI implementation.
