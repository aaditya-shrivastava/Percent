# Percent Admin Phase 3C — manual SQL handoff

Status: **prepared locally; not executed**. Product Editor and Product Management publication UI work has not started.

## Run target

Run only in **Supabase Dashboard → Percent → SQL Editor** after verifying project reference `gijyjdeohvdrnvqfqdha`.

Migration file and exact SQL:

`supabase/migrations/20260915025947_admin_product_publication.sql`

Run the complete file, including `begin` and `commit`. Do not run `supabase db push`, do not run migration repair, and do not rerun blindly if the result is uncertain.

## Purpose and responsibilities

The migration creates one narrow API RPC:

`public.publish_product(product_id uuid, expected_updated_at timestamptz)`

It derives the actor from `auth.uid()`, verifies the existing private admin role, locks the product/variants/physical units, checks the supplied product version and performs all readiness validation again on trusted database state. On success it changes only:

- `status` to `active`
- `is_visible` to `true`
- `is_shop_available` to `true`
- `launch_at` to the existing value or the publication time
- `updated_at` to the publication time

It creates no inventory, orders, payments, shipments or sales.

## Readiness enforced

Publication requires:

- an actual draft with no archive or sold-out marker;
- no `[Verification]` product name, in addition to every normal readiness rule;
- non-empty name, slug and design code;
- positive product price and production limit;
- valid existing fit and an active category;
- at least one enabled variant;
- every enabled variant to have non-empty size/SKU and a positive price;
- a primary direct HTTPS image that the current public catalog can render;
- historical produced quantity equal to the configured production limit;
- at least one eligible unsold/unwithdrawn unit on an enabled variant;
- zero sold units while still draft;
- a matching `expected_updated_at` value.

Withdrawn units count toward historical production but not eligible stock. Under-allocation returns the exact remaining unit count. Over-production, no sellable inventory, sold history, archived/completed lifecycle and stale state are rejected.

## Security and grants

The RPC is a narrowly scoped `SECURITY DEFINER` function with a fixed empty search path, fully qualified application objects, no dynamic SQL and no caller-provided actor or arbitrary identifiers. Default/PUBLIC, anonymous and service-role execution are revoked. `authenticated` receives execution, while the function itself requires `private.is_admin()`.

A private, non-callable trigger function guards the existing product table. It rejects authenticated direct `draft → active` updates unless the update is executing inside the privileged publication RPC, and rejects every backwards `active/archived → draft` transition. Existing draft editing, active-to-archive behavior and sold-out archival remain available under their existing rules.

Public product and child RLS policies are unchanged. The private Storage bucket remains private, and publication cannot expose an unresolved private media reference.

## Structural impact

- New tables: 0
- New columns: 0
- New schemas: 0
- New public RPCs: 1
- New private trigger functions: 1
- New triggers: 1

No data rows are changed by installing the migration.

## Rollback implications

Before any publication occurs, rollback can revoke/drop `public.publish_product`, drop `guard_product_publication`, and drop `private.guard_product_publication`.

After a product is published, removing the function/trigger does not and must not silently return it to draft. The active product remains visible and its production run remains locked. Any future lifecycle reversal requires a separately approved business operation; Phase 3C intentionally provides no unpublish or restore path.

## Local validation

The complete migration chain loaded successfully. Local database tests passed for anonymous/customer denial, admin publication, incomplete allocation rejection with the exact remaining count, stale `PT409`, direct activation bypass denial, full 20/20 publication, active allocation lock and permanent no-return-to-draft behavior. Existing allocation and inventory-adjustment regression suites also passed.

## Manual gate

After running the SQL successfully, reply exactly:

`SQL executed successfully`

Only then should hosted function/grant verification, generated types, readiness UI, confirmation flow and browser/responsive verification continue.
