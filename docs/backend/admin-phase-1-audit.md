# Admin Phase 1 — audit and stop report

Historical report: the role blocker was subsequently resolved through the user's explicit narrow RPC authorization. See [Admin Phase 1 completion report](admin-phase-1-completion-report.md) for the final implementation and verification.

Date: 13 September 2026. Status: blocked before implementation under the user's explicit no-schema/no-security-change rule.

## Project verification

The available Supabase connector confirmed Percent (`gijyjdeohvdrnvqfqdha`), ap-south-1, ACTIVE_HEALTHY. All hosted operations were read-only and targeted that project. No unrelated project was accessed.

## Existing implementation

The project uses React, TypeScript, Vite, React Router, lucide-react, and Supabase JS 2.99.1. It already has one BrowserRouter, a Supabase browser client with a publishable key, generated public-schema types, a shared session hook, and centralized data modules under src/backend. No additional router, state library, auth provider or UI framework is needed.

App.tsx currently wraps all routes in the storefront header/footer. An admin route branch would need its own shell. main.tsx gates initial rendering on storefront catalog loading, which would also need to be separated from admin initialization without changing the storefront appearance. Global CSS contains broad element rules and existing responsive breakpoints including 1150, 980, 900 and 620 pixels; admin styles should be scoped beneath an admin root.

## Confirmed blocker: browser cannot resolve protected role

- Roles live in private.user_roles and support customer, admin and super_admin.
- Its read_own_role SELECT policy allows authenticated users to read only their own role at the database level.
- The live Data API exposes only public and graphql_public. A read-only request for private.user_roles with limit=0 returned HTTP 406, PGRST106, "Invalid schema: private".
- private.is_admin() is not exposed as a public RPC and returns only a boolean, not the distinct role labels required by the brief.
- The hosted public RPCs are catalog_stock and save_address. Neither resolves roles.
- The only deployed Edge Function is percent-review-media; it is not an admin-role endpoint.
- The existing session hook resolves Auth and profile data, but no protected role. Generated types cover the public schema only.

A production route guard cannot satisfy the requested role resolution using the existing browser-accessible API. It must not guess roles from localStorage, user metadata, URL parameters, or the results of unrelated data queries. Adding a role RPC or another server interface would be new backend infrastructure, explicitly prohibited in this phase. Therefore implementation stopped.

## Other findings

- private.audit_logs already exists and has an admin SELECT policy, but the unexposed schema also prevents browser access. Recent activity can use the brief's permitted empty/unavailable fallback; this alone does not require a new table.
- Authenticated admins have RLS-backed reads on public products, inventory_units, orders, order_items, profiles and reviews. These can support dashboard metrics after role resolution is available.
- inventory_summary is server-only: authenticated SELECT is not granted. Admin inventory counts can instead be computed from authorized inventory_units reads with complete pagination. Do not change the view grant merely for convenience.
- A strict customer-only count excluding staff cannot be obtained by counting profiles alone. It needs a role-aware existing server interface or a separately approved aggregate. Label a profile count as registered accounts if used, rather than claiming it excludes admins.
- No protected role rows currently exist, so admin and super_admin live acceptance tests also require deliberately authorized account provisioning. No account was created or promoted.
- The supplied attachment directory contains only the textual brief. No approved visual mockup was attached there or found under an admin-named project file. The written visual direction is available, but exact mockup matching requires the reference images/file.

## Completion status

1. Files added: this audit report only.
2. Application files modified: none during this request. Pre-existing working-tree changes were preserved.
3. Admin routes created: none; blocked before coding.
4. Guard: not implemented; protected role resolution unavailable through current API.
5. Supabase operations: get-project, function listing, read-only schema/function/policy/privilege/role-count inspection, and a zero-row Data API schema probe.
6. Dashboard metrics: not implemented or fabricated.
7. Unavailable metrics: conversion analytics; strict customer-only aggregate through current public API.
8. Responsive behavior: not implemented/tested.
9. Accessibility work: not implemented/tested.
10. Lint/typecheck/build/route/responsive tests: not run because application code was not changed. The live API probe confirmed the blocker.
11. DATABASE CHANGES = NONE. No migrations, tables, grants, RLS changes, seeds, catalog updates or hosted deployments.
12. Backend gaps: protected own-role API; optional protected activity access; deliberate first-admin provisioning.
13. Next step: resolve the role-read boundary with explicit authorization, then complete Admin Phase 1. Products/Product Editor remains the later phase, not the next automatic action.

## Smallest proposed exception, not implemented

Authorize a narrowly scoped authenticated endpoint/RPC returning only the caller's current role from the existing private.user_roles table. Keep the private schema unexposed and preserve existing RLS. No new tables are needed. The user must explicitly permit the necessary backend change before it is made. Separately identify the account to provision as the first admin/super_admin; do not infer an account from the example name in the brief.
