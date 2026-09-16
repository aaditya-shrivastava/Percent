# Percent Admin Phase 1 — completion report

Date: 13 September 2026.

Implemented locally: protected admin foundation, approved mockup-based shell, real dashboard, and placeholder routes. Hosted deployment is limited to the explicitly authorized role RPC. No Products editor, Inventory editor, checkout, Razorpay, or Delhivery implementation was added.

## 1. Files added

- `src/admin.css`: isolated admin tokens, desktop/tablet/mobile layout, drawer, cards, tables, empty/loading/error states.
- `src/backend/admin/access.ts`, `role.ts`: role resolution and real Supabase adapter.
- `src/backend/admin/dashboard.ts`, `metrics.ts`: dashboard reads and per-design stock calculations.
- `src/hooks/useAdminAccess.ts`: session-aware guard state and role revalidation.
- `src/components/admin/AdminRouteGuard.tsx`, `AdminShell.tsx`, `AdminComponents.tsx`.
- `src/pages/admin/AdminRoutes.tsx`, `AdminDashboard.tsx`, `AdminPlaceholder.tsx`.
- `src/components/layout/StorefrontBootstrap.tsx`: storefront-only catalog initialization.
- `supabase/migrations/20260913055301_percent_get_my_role.sql`.
- `supabase/test-role-rpc.mjs`, `prepare-admin-role-tests.mjs`, `test-hosted-admin-role.mjs`, `test-hosted-admin-dashboard.mjs`.
- `scripts/test-admin-foundation.mjs`.
- This report, `admin-role-hosted-tests.json`, `admin-dashboard-hosted-tests.json`, and `admin-role-security-advisors.json` in `docs/backend`.

## 2. Existing files changed

- `src/App.tsx`: lazy admin route branch separate from the existing storefront header/footer.
- `src/main.tsx`: catalog initialization moved into StorefrontBootstrap so admin does not depend on storefront data loading.
- `src/backend/database.types.ts`: added the generated RPC signature.
- `dist/index.html` and generated assets: refreshed production build.
- `docs/backend/admin-phase-1-audit.md`: historical blocker marked resolved by the subsequent narrow authorization.

The workspace already contained uncommitted Phase 1/2 backend and storefront work. Those earlier changes were preserved. Earlier migrations were not rewritten for this admin task. No dependency was added.

## 3. Admin routes

`/admin` is the real dashboard. The following are guarded placeholders with “Coming in next Admin phase” and a dashboard return link:

`/admin/products`, `/admin/inventory`, `/admin/orders`, `/admin/customers`, `/admin/reviews`, `/admin/website`, `/admin/blog`, `/admin/coupons`, `/admin/analytics`, `/admin/users`, `/admin/settings`, `/admin/media`.

Global navigation uses `/admin/website?section=navbar`, `footer`, `branding`, `colors`, `typography`, and `social-links`. Unknown admin paths remain inside the guard and render an unavailable-page state.

## 4. Role guard

The guard uses the existing authenticated Supabase session plus `auth.getUser()` and parameterless `get_my_role()`. Only `admin` and `super_admin` are allowed. Customer, null, unknown roles, missing identity, identity mismatch, and RPC failures fail closed. The server-validated identity is checked again after role resolution to reject an in-flight account switch.

Logged-out users return to the existing login page with the requested admin destination preserved. Protected content is not mounted during initial, account-change, or route-change validation. Existing authorized content remains stable during background revalidation; denial or failure removes it. Focus, visibility, route changes, and a 60-second interval refresh role information. Existing hosted RLS independently enforces access on every data request.

No localStorage role, editable user metadata, browser role claim, service-role key, or profile role copy determines access. Supabase's normal session persistence is retained.

## 5. Supabase reads

All requests target Percent, `gijyjdeohvdrnvqfqdha`, verified by the available Supabase connector as ap-south-1 / ACTIVE_HEALTHY. No operation targeted an unrelated project.

| Source | Purpose |
| --- | --- |
| `auth.getUser()` and `public.get_my_role()` | Validated caller and protected role |
| `orders` | Selected-period order count, completed/paid revenue, daily revenue, recent orders |
| `order_items` | Product descriptions and quantities for recent orders |
| `profiles` | Exact registered-account count and recent customer display names |
| `products` | Current live/draft counts and configured production limits |
| `product_variants` | Enabled inventory variants |
| `inventory_units` | Allocated, sold, withdrawn, and available pieces |
| `product_reviews` | Pending review count |

Collections are explicitly paginated in batches of 500 instead of silently accepting the API row cap. Failed reads discard the dashboard snapshot and show a retry state. Requests are aborted when the dashboard unmounts or its range changes. No operational writes are made by the dashboard.

## 6. Real metrics and production limits

Revenue sums integer paise only for paid, completed orders. Orders include all statuses in the selected period. Registered Accounts explicitly includes staff. Products Live counts visible active products; draft designs and pending reviews are current counts. Date filters support 7, 30, 90 days and all time; the selection survives refresh in the URL.

The verified catalog contains 27 draft designs, zero live products, zero orders and zero revenue. Four disposable accounts temporarily appeared in the real account count during tests; those are test fixtures, not sample UI metrics. All four were signed out and removed after verification. Hosted cleanup confirmed zero remaining test users, zero profiles and zero role rows, with 27 draft products and zero orders preserved. The local disposable credential file was deleted.

Inventory reads each product's `production_limit`. Sold out uses `sold >= production_limit`; nearing the run limit uses 90% of that product's limit. Low-stock thresholds also derive from that limit. Allocated, sold, and available pieces are distinct; withdrawn pieces and disabled variants are not counted as available. Tests cover limits of 100, 250, 500, and 1,000, including the 156 / 250 example. No global 100-piece rule was introduced.

## 7. Intentionally unavailable metrics

No fabricated revenue, orders, conversion rate, percentage growth, historical comparison, campaign activity, delivery date, or chart points appear. Empty sales and orders have explicit empty states. Recent Activity is marked not connected because the existing audit data is private. No permissions were expanded to expose it. A strict customer-only count is unavailable through the approved caller-only role RPC, so the dashboard accurately labels its profile count Registered Accounts.

## 8. Design and responsive behavior

The supplied screenshot guided the charcoal surfaces, burgundy icon accents, subtle borders, Percent mark, navigation, four metrics, and two-column dashboard arrangement. Mockup sample numbers and names were not used as live data.

Desktop has a fixed collapsible sidebar. Tablet uses a compact icon sidebar and stacked dashboard. Mobile uses an off-canvas dialog and rearranged cards. The orders table scrolls within its own region. Browser layout measurements passed at 1440, 1280, 1024, 834, 768, 425, 390, 375, 360, and 320 pixels with no document-level horizontal overflow after fixing an absolutely positioned table label.

Storefront layout components and stylesheet were preserved. Login, profile, and the home route rendered with their existing storefront navigation/footer during browser checks. This was a smoke check, not a pixel-by-pixel regression audit of every customer page.

## 9. Accessibility

Semantic navigation, headings, labelled date select and icon buttons, active navigation states, skip link, visible keyboard focus, status/error announcements, reduced-motion support, and a keyboard-scrollable table region are included. The modal drawer has explicit Tab/Shift+Tab wrapping, Escape closing, focus restoration, and a close button. Browser checks confirmed focus wrapping and Escape behavior.

## 10. Verification

- `npm run build`: passed TypeScript project checks and Vite production build.
- `npm run lint`: passed.
- `git diff --check`: passed.
- `node scripts/test-admin-foundation.mjs`: passed role allow/deny, identity-switch, RPC-error, per-design inventory, and date tests.
- `node supabase/test-role-rpc.mjs`: passed actual migration-chain tests, all three roles, null/no identity, anon denial even with a supplied UID claim, no argument acceptance, no role writes, invoker rights, fixed search path.
- `node supabase/test-hosted-admin-role.mjs`: passed real hosted sign-in/RPC tests for customer/admin/super_admin/missing-role, parameter rejection, private API rejection, editable-metadata escalation rejection, and restored sessions.
- `node supabase/test-hosted-admin-dashboard.mjs`: passed actual dashboard queries for admin/super_admin and denial for customer/missing-role.
- Browser: verified unauthenticated return-to redirect, admin and super-admin dashboards, refresh, persisted range, customer denial, primary/sidebar and global placeholders, sign-out, ten responsive widths, and drawer keyboard behavior.

The production build retains the pre-existing large-main-chunk warning (about 610 kB before gzip). The lazy admin chunk is about 30 kB. No bundle-size warning was suppressed.

## 11. Database changes

**NEW TABLES = 0. NEW ROLE TABLES = 0.** One dedicated migration creates `public.get_my_role()` and its execution grants. It is SQL, STABLE, SECURITY INVOKER, with fixed empty search_path and fully qualified objects. It reads `private.user_roles` only where `user_id = auth.uid()` and returns one scalar text value or null.

PUBLIC, anon, authenticated and service_role execution privileges are revoked first; execute is then granted only to authenticated. Anon cannot execute the RPC. No user ID parameter exists. Existing row-level security and own-role grants apply without SECURITY DEFINER. The private schema remains unexposed through the Data API. No other schema, policy, Storage, Auth setting or Edge Function was changed for the admin task.

## 12. Remaining gaps and operational notes

- Recent administrative activity needs a separately approved, narrowly designed backend read surface in a future phase.
- No permanent admin account was provisioned. A real account must be explicitly selected and assigned an existing protected role by an authorized operator before the owner can use the panel.
- Security advisors report the existing “Leaked Password Protection Disabled” Auth warning. No new RPC advisory was reported. See [Supabase password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This setting was not changed under the narrow authorization.
- Dashboard date boundaries use the browser's local timezone; daily sales keys use stored UTC dates. An explicit business reporting timezone should be agreed before sales reporting becomes operational.
- Dashboard aggregation currently reads the authorized rows to compute totals. It is appropriate for the current empty store; higher data volume should prompt an explicitly approved server aggregation design.
- Frontend changes are local and production-build verified; no frontend hosting deployment was requested or performed.

## 13. Next phase

Recommended next: Admin Products + Product Editor, only after approval. Keep per-design production limits configurable and preserve existing inventory safeguards. Products, Inventory and other operational modules remain placeholders. Work stops at Phase 1.
