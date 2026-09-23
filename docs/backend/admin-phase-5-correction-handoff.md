# Percent Admin Phase 5 — customer identity correction

Date: 2026-09-21  
Target: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
Migration: `supabase/migrations/20260921143000_admin_customer_identity_correction.sql`

## Hosted verification finding

The deployed functions have the expected `SECURITY DEFINER`, fixed empty search path, owner, and grants. However, their first read-only aggregate check returned zero customers.

Hosted counts proved the cause:

- Auth users: 1
- Profiles: 1
- Owned orders: 2
- Profiles with orders: 1
- Role distribution: one `super_admin`, zero `customer`

The first migration treated `private.user_roles.role = 'customer'` as customer identity. Percent has one role per account, so promoting a purchasing account to `super_admin` incorrectly removed its profile and order history from Customers Management.

The authoritative customer/account identity is `auth.users.id = public.profiles.id`. Role is an access attribute and is now returned as `account_role`; it does not decide whether the account exists in customer intelligence.

## Correction

The migration uses `CREATE OR REPLACE` for the same two functions and changes only their identity joins:

- customer list includes every Auth-backed profile;
- customer detail includes every Auth-backed profile;
- `account_role` is returned for transparency;
- admin caller checks, grants, pagination, aggregation, money rules, and all existing RLS remain unchanged.

Structural impact remains:

- New tables: 0
- New columns: 0
- New schemas/views: 0
- Additional RPCs: 0
- Function replacements: 2
- Hosted data mutations: 0

Execute the complete SQL in [the correction migration](../../supabase/migrations/20260921143000_admin_customer_identity_correction.sql), then resume hosted verification and UI implementation.
