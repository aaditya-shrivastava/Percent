# Percent Admin Phase 4B — completion report

## Re-audit on 2026-09-16

The available Supabase project-list connector again identified only **Percent**, `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. Read-only hosted SQL confirmed that `orders`, `order_items`, `order_addresses`, `order_lifecycle_history`, and the original six-argument `update_order_lifecycle` RPC already exist. The hosted status check constraints, RPC definition, RLS policies, table grants, and enabled immutability/updated-at/audit triggers match the architecture below. Hosted counts remain **0 orders, 0 items, 0 addresses, 0 lifecycle rows**.

No duplicate backend object or hosted SQL change was needed. This re-audit made one client improvement: lifecycle RPC business errors now appear as specific Admin messages for invalid transitions, cancellation safety, manual payment changes, completion evidence, and permission denial. `PT409` continues to offer a reload choice. The local order test fixtures were updated with the Storage-operation helper needed to replay the current migration chain in PGlite. Neither fixture update changes hosted behavior.

Reverification passed: Admin order model, order RLS, and lifecycle transition/atomicity tests; TypeScript; ESLint; production build; and `git diff --check`. Hosted positive lifecycle mutation remains untested because there is no real hosted order and no fake production order was inserted. The existing completion evidence below describes the earlier local UI and responsive verification; it was not repeated during this re-audit.

Completed locally 2026-09-15. Hosted verification used only the available Supabase connector against **Percent**, `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. Phase 4C has not begun.

## Existing lifecycle and allowed transitions

The order fields have three independent sets of schema-constrained text values:

| Field | Existing values |
| --- | --- |
| `status` | `pending`, `confirmed`, `cancelled`, `completed` |
| `payment_status` | `unpaid`, `pending`, `paid`, `failed`, `partially_refunded`, `refunded` |
| `fulfillment_status` | `unfulfilled`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `returned` |

The trusted Phase 4B operation allows:

| Dimension | From → To | Conditions |
| --- | --- | --- |
| Order | `pending → confirmed` | Internal confirmation |
| Order | `pending/confirmed → cancelled` | Required reason; payment `unpaid` or `failed`; fulfillment `unfulfilled` or `processing`; no shipping provider or tracking reference |
| Order | `confirmed → completed` | Existing `paid` status with provider/reference and `delivered` status with shipping provider/tracking/delivery timestamp |
| Fulfillment | `unfulfilled → processing` | Order already `confirmed`; internal preparation only |

Cancellation atomically sets the separate fulfillment field to `cancelled` and writes two history rows preserving each previous value. `cancelled` and `completed` lock further Admin lifecycle changes. Payment has **no Admin mutation action**. Shipment and courier states have no Admin mutation action. No arbitrary status selector exists.

## SQL and history architecture

Immutable lifecycle history required SQL: the existing `private.audit_logs` has actor/table/operation/row/time but no old/new value, reason or note. The user manually executed [20260915130509_admin_order_lifecycle.sql](../../supabase/migrations/20260915130509_admin_order_lifecycle.sql) on Percent. The migration adds one narrow `public.order_lifecycle_history` table, one index, one admin-read RLS policy, one UPDATE/DELETE-blocking trigger, and one `public.update_order_lifecycle` RPC. It adds no column to an existing table and no schema.

Hosted inspection verified:

- history RLS enabled; `authenticated` SELECT only, with `private.is_admin()` policy;
- `anon` SELECT denied; `authenticated` INSERT/UPDATE/DELETE denied;
- immutable trigger enabled;
- RPC owner `postgres`, `SECURITY DEFINER`, empty fixed search path;
- `authenticated` execute granted; `anon` and `PUBLIC` execute denied;
- no order or history fixture inserted by the migration.

The RPC derives actor identity solely from `auth.uid()`, checks the existing private admin predicate, locks the order, checks `expected_updated_at`, validates the transition, updates only order/fulfillment status, and inserts history in one transaction. Stale submissions raise `PT409`. A failed history write rolls back the status write. Browser roles have no direct `orders` UPDATE grant. Internal note and reason are stored in history only, trimmed, bounded, and immutable after insertion. The order-created timeline item uses the explicit `created_at`; it is **not** presented as a retroactively fabricated Phase 4B history row.

The private existing order audit trigger continues recording the coarse table operation. It is separate from the new old/new lifecycle history.

## Admin routes

`/admin/orders/:id` preserves the Phase 4A purchase-time items, address snapshot, INR totals, payment evidence display and shipping evidence display. Its new Order Actions section shows current order/payment/fulfillment statuses as text and only backend-approved next actions. Significant actions open a labeled modal with current/next status and confirmation. Cancellation requires a labeled reason, accepts an optional internal Admin note, and warns that refund, inventory restoration and shipment cancellation are not automatic. The modal traps focus, closes with Escape, and returns focus to the action button.

The Order History section reads only stored lifecycle rows, ordered with explicit creation and delivery timestamps. It shows date/time, changed dimension, previous/new value, actor display name, reason, and an expandable Admin-only note. History is never editable from the UI. Successful mutation reloads authoritative order and history data. A `PT409` result offers **Reload Latest** or **Stay on Page**, with no automatic retry or optimistic authoritative update.

`/admin/orders` continues to fetch real metrics, filters, badges and pages on mount; navigating back after a lifecycle action remounts the dashboard and refetches authoritative rows. With no hosted orders, it shows the real zero state and no lifecycle action. A missing valid order ID shows the not-found state and no action.

## Payment, fulfillment and inventory boundaries

The Admin cannot mark an order paid, set payment references, capture, verify or refund payment. `completed` is evidence-gated and unavailable in today's hosted state without trusted payment and delivery data. `processing` denotes internal preparation; it does not create a shipment, AWB, tracking number, courier scan or delivery estimate. Cancellation does not change payment fields or call any payment/shipping integration. No Phase 4B code reserves, produces, sells, withdraws, releases or restores inventory.

Customer My Orders/tracking and storefront checkout remain frontend previews and are outside this phase. No checkout order creation, Razorpay, Delhivery, returns or customer cancellation flow was added.

## Verification

Local fixture tests passed:

- actual status and explicit transition map, including evidence-gated completion;
- `admin` and `super_admin` allowed; customer and anonymous denied;
- forbidden jumps and final-state locks;
- cancellation reason and payment/shipping safety gate;
- `PT409` stale-write rejection;
- immutable history with authenticated actor and old/new values;
- injected history-write failure rolling back the order status;
- direct browser order/history writes denied;
- no inventory mutation and no fabricated payment or shipping evidence.

Passed commands: `node --experimental-strip-types scripts/test-admin-orders.mjs`, `node supabase/test-admin-orders.mjs`, `node supabase/test-order-lifecycle.mjs`, publication and Phase 3 inventory regression fixtures, TypeScript, ESLint, Vite production build, and `git diff --check`.

Authenticated hosted browser verification confirmed the zero-order dashboard and missing-order detail state. A **temporary local-only component fixture** rendered populated controls and history at 1440, 1280, 1024, 834, 768, 600, 425, 390, 375, 360 and 320 px; all had no page-level horizontal overflow. The browser represented requested 425 px as 426 px. The fixture also confirmed cancellation validation, Escape and focus restoration. It was removed from source after testing.

Final hosted readback: **0 orders, 0 order items, 0 order addresses, 0 lifecycle rows**; 269 existing inventory units; 31 products, 0 active and 0 visible; one permanent owner account remains `super_admin`. No hosted order, customer, payment, shipment, product, inventory or role test mutation occurred.

## Advisors, structural impact and limitations

The security advisor reports the authenticated `SECURITY DEFINER` lifecycle RPC under its generic warning category. This is the deliberately narrow trusted write path and has an internal `auth.uid()` plus admin-role check, empty search path, explicit transitions, and revoked anonymous/public execution. The advisor also retains pre-existing inventory/publication RPC warnings and disabled leaked-password protection. [Security-definer linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable); [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The performance advisor reports an INFO-level unindexed foreign key on the new actor reference, plus unused-index and multiple-policy notices. No second SQL change was made for an informational advisor notice.

Structural impact: **1 new table, 0 new columns on existing tables, 0 new schemas, 1 new RPC**. History rows cannot be dropped without destroying audit evidence. If a later CLI deployment uses migration history, reconcile the manually executed version first:

```powershell
npx --yes supabase@2.75.0 migration repair 20260915130509 --status applied --linked
```

This command was not run automatically. Hosted orders are empty, so no hosted lifecycle mutation was attempted. True provider payment/delivery transitions, real checkout, reservations, stock deduction, refunds, shipment events, returns and customer cancellation remain future work. Phase 4B stops here before Phase 4C.
