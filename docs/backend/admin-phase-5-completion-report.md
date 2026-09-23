# Percent Admin Phase 5 — Customers Management Completion Report

Date: 21 September 2026  
Target project: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
Status: **COMPLETE — STOPPED BEFORE PHASE 6**

## Delivered

- Added the real Customers dashboard at `/admin/customers`.
- Added the read-only customer detail route at `/admin/customers/:customerId`.
- Connected both screens to the hosted `admin_list_customers` and `admin_get_customer` RPCs.
- Added server-side search, eligibility filters, sorting, and bounded pagination (25 customers per page).
- Added real summary metrics for eligible accounts, customers with orders, current UTC-month joins, and non-cancelled order value.
- Added Auth-backed identity, role, phone, join date, order totals, addresses, reviews, wishlist activity, and recent order data.
- Added desktop table and mobile card presentations with responsive tablet and phone layouts.
- Kept the feature read-only. No browser role mutation or customer data mutation endpoint was introduced.

## Hosted database verification

The Supabase connector verified the target as **Percent**, project ref `gijyjdeohvdrnvqfqdha`. The unrelated `spacetees` project was not accessed.

The user-executed migration `20260921160000_admin_customer_eligibility_refinement.sql` was verified on the hosted project. It refines customer eligibility to include an account when either:

- its role is `customer`; or
- it has an order, address, review, or wishlist entry.

This preserves operational customer records while excluding staff-only accounts with no customer activity.

Security checks confirmed:

- both customer RPCs are `SECURITY DEFINER` with an empty fixed `search_path`;
- execution is unavailable to `public` and `anon`;
- execution is granted to `authenticated` only;
- each RPC performs the existing admin/super-admin authorization check;
- no browser write path or role self-assignment capability was added.

Hosted readback for the current eligible account returned:

- total customers: 1;
- customers with orders: 1;
- current UTC-month joins: 1;
- non-cancelled order value: 299800 paise (`₹2,998`);
- detail: 2 orders, 1 address, 0 reviews, 0 wishlist items.

## Database changes

- New tables: **0**
- New columns: **0**
- New public mutation endpoints: **0**
- Hosted data mutations during verification: **0**

Phase 5 uses the two existing/refined read-only admin RPCs. No Phase 6 schema or application work was started.

## UI verification

Authenticated browser checks passed against the local production-connected application:

- `/admin/customers` loaded hosted metrics and the eligible account list;
- `/admin/customers/:customerId` loaded the Auth-backed profile and real related activity;
- INR values remained correctly converted from paise (`299800` → `₹2,998`);
- the desktop table, tablet detail layout, and 390 px mobile customer-card layout rendered without missing content;
- empty review and wishlist sections displayed safe empty states;
- order rows link to the existing admin order detail route.

## Automated verification

All required checks passed:

- `npm run lint`
- `npx tsc -b --pretty false`
- `npm run build`
- `node supabase/test-admin-customer-eligibility.mjs`
- `node supabase/test-admin-orders.mjs`
- `node --experimental-strip-types supabase/test-money-format.mjs`
- `git diff --check`

The production build emitted the existing informational warning for a JavaScript chunk over 500 kB; the build completed successfully.

## Final state

**PHASE 5 — CUSTOMERS MANAGEMENT VERIFIED**

Work stopped before Phase 6 as requested.
