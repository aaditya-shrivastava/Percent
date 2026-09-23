# Percent Admin Phase 5 — customer eligibility refinement SQL handoff

Date: 2026-09-21  
Target: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
New migration: `supabase/migrations/20260921160000_admin_customer_eligibility_refinement.sql`

The previously executed `20260921143000_admin_customer_identity_correction.sql` remains unchanged.

## Eligibility rule

An Auth-backed profile is included when at least one condition is true:

1. `account_role = 'customer'`;
2. at least one order exists;
3. at least one saved address exists;
4. at least one product review exists; or
5. at least one wishlist item exists.

This includes customer-role accounts before their first activity and staff accounts with genuine customer activity. It excludes admin or super-admin accounts that have no customer activity. Role remains an access attribute returned separately as `account_role`.

## Function replacements

`admin_list_customers` applies eligibility in `customer_base`, before aggregate metrics, search, filters, sorting, and pagination. Every dashboard metric therefore uses only the eligible population.

`admin_get_customer` applies the same eligibility expression to the requested UUID. A staff-only account resolves to SQL/JSON null, while the existing purchasing super-admin resolves normally.

## Security and impact

The migration preserves `auth.uid()` caller derivation, `private.is_admin()`, `SECURITY DEFINER`, the empty search path, fully qualified relations, revoked `public`/`anon` execution, authenticated-only execution, and no direct browser access to `auth.users`.

- New tables: 0
- New columns: 0
- New schemas: 0
- New RPCs: 0
- Function replacements: 2
- RLS changes: 0
- Hosted data mutations: 0

## Local test matrix

The local PGlite test passed all required cases:

- customer role with no activity: included;
- super-admin with an order: included;
- admin with a wishlist item: included;
- staff-only admin: excluded;
- staff-only super-admin: excluded;
- staff-only customer detail: null;
- purchasing super-admin detail: returned with `account_role = super_admin`.

It also verified anon/customer execution denial, admin/super-admin execution, order-reference search, eligible-population metrics, and paise-preserving lifetime value.

## Complete SQL

The complete executable SQL is in [20260921160000_admin_customer_eligibility_refinement.sql](../../supabase/migrations/20260921160000_admin_customer_eligibility_refinement.sql).

It has not been executed by Codex. Customers UI work remains paused until manual execution is confirmed.
