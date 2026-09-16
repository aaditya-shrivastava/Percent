# Percent Admin Phase 2A — implementation and verification report

Date: 13 September 2026. Status: implementation complete locally; final real-session and responsive browser verification pending owner sign-in. This is not yet a full acceptance pass.

## Permanent role provisioning

The available Supabase connector verified Percent (`gijyjdeohvdrnvqfqdha`), ap-south-1, ACTIVE_HEALTHY. An exact case-insensitive email lookup uniquely resolved the requested existing, confirmed Auth account. Its profile had the same backend-resolved UUID and its previous role was customer. A guarded database update changed only that existing `private.user_roles` record to super_admin. No Auth user was created, no password was requested or changed, and no email/UUID was embedded in application code.

An authenticated database-role check with that verified subject returned `get_my_role() = super_admin`, one linked profile and 27 readable products. The authenticated database role cannot UPDATE `private.user_roles`. This verifies database authorization, not a fresh password sign-in or browser session. The Auth record already showed successful prior sign-in. Final owner-session browser verification remains pending.

## 1. Product page

`/admin/products` now renders the real product index within the unchanged Phase 1 shell. The approved Product Management image guided the charcoal table surfaces, compact thumbnails, burgundy accents, status tabs, search toolbar and white Add Product button. Its editor panel, fake counts, bulk actions and Delete control were deliberately excluded under the written Phase 2A scope.

## 2–3. Files

Added:

- `src/backend/admin/product-model.ts`: price formatting, run calculations, search/filter/sort, archive eligibility.
- `src/backend/admin/products.ts`: centralized catalog reads and constrained archive action.
- `src/pages/admin/AdminProducts.tsx`: product table/cards, summaries, filters, menus and archive confirmation.
- `src/pages/admin/AdminProductEditorPlaceholder.tsx`: Phase 2B Add/Edit placeholders.
- `scripts/test-admin-products.mjs`: pure model and eligibility tests.
- This report.

Modified:

- `src/pages/admin/AdminRoutes.tsx`: Products index plus `/admin/products/new` and `/admin/products/:id/edit`.
- `src/admin.css`: scoped product-page styles and mobile cards/filter disclosure.
- `dist/index.html` and generated build assets.

Existing unrelated workspace changes were preserved. Storefront pages, slugs, images, inventory records, and the Admin shell were not edited for this phase.

## 4. Real Supabase queries

The products service validates admin access, then fetches explicit columns from products, product_variants, product_images, inventory_units, categories, tags and product_tags. Each collection uses ordered 500-row pages. This is a fixed set of bulk reads, with no per-product network query. Images prefer the primary role then sort order. Missing/broken images fall back to a product icon.

Run counts are derived from the existing physical-unit records. No independent stored stock counter, aggregate table, search service or new RPC is introduced. Requests support cancellation. A failed read shows a generic retry state rather than partial or fabricated data.

## 5–6. Hosted catalog counts

Read-only verification returned 27 products: 27 draft, zero active, zero archived; 216 variants and zero allocated units. There is one Auth account. All products remain unchanged and unpublished. An anon-role query returned zero visible drafts.

## 7. Search, filters and sorting

Search is debounced by 200 ms and matches name, stable slug, design code, variant SKU and tag name/slug. Status tabs show full-catalog counts. Category and fit choices come from the actual catalog. Availability distinguishes available-to-sell stock, no available stock and near-limit runs. Sorting supports newest/oldest, both name directions, both price directions, most sold and lowest run remaining. Clear filters resets search and selections. No-result and empty-catalog states are distinct.

Client filtering is intentional for 27 products; service-level paging prevents API row-cap truncation and leaves room for later list pagination.

## 8–9. Production and price

Every row uses its own production_limit. Production displays sold / limit with labelled progress. Run remaining is max(limit − sold, 0); available-to-sell quantity separately excludes sold/withdrawn units, disabled variants and non-active/non-shop-available products. Zero temporary stock does not archive a design. Sold Out is a derived display label, not a new stored lifecycle state.

Tests verify 120 / 250 gives 48% and 130 remaining, and 720 / 1000 gives 72% and 280 remaining. INR uses one helper dividing paise by 100: 129900 becomes ₹1,299. Fractional rupees are retained when present.

## 10–11. Responsive and accessibility

Desktop uses the compact full table; tablet allows contained horizontal scrolling. At 700px and below, the table is replaced with product cards containing image, title, lifecycle, price, variant count, progress, remaining quantities and action menu. Search stays visible; filters/sort use a labelled disclosure. Controls have labels, status is textual, progress includes sold/limit semantics, menus support keyboard and Escape, and the archive dialog wraps focus and starts on Cancel.

Required browser width checks (1440, 1280, 1024, 834, 768, 600, 425, 390, 375, 360, 320) remain pending authenticated owner sign-in. CSS implementation alone is not reported as a responsive test pass.

## 12–13. Permissions and Archive

Existing shared guard and RLS authorize admin and super_admin. Customer/null/unknown roles remain rejected by the unchanged guard; local guard and actual migration-chain tests pass. No temporary hosted customers or admins were created.

Archive is offered only to non-archived products whose allocated unit count equals their configured limit. The confirmation explicitly states permanence. The service revalidates role, writes only status, archived_at, visibility and shop availability, and conditions the update on the original updated_at to reject stale records. Existing backend RLS and deferred complete-run validation remain authoritative. No existing catalog product currently qualifies, so no hosted archive was performed. Restore is permanently omitted. No lifecycle or permission expansion was made.

Public preview uses `/product/:slug` only for visible non-drafts. Drafts receive an explanatory message without relaxing RLS. Add/Edit lead only to Phase 2B placeholders.

## 14. Deferred operations

Product Editor fields, image uploads, inline edits, production-limit edits, stock edits/adjustments, inventory allocation, permanent deletion, Restore, Duplicate, Publish, bulk actions, Website Editor, payment/shipping providers and checkout/order creation remain deferred.

## 15. Verification status

- TypeScript and production build: passed.
- ESLint and `git diff --check`: passed on the final implementation.
- Model tests: passed search fields, all sorts, filters, no results, paise conversion, configured production limits and archive eligibility.
- Existing admin guard tests: passed both admin roles, customer/null/unknown denial, absent/mismatched identity, account switch and RPC failure.
- Actual migration-chain role tests: passed caller-only roles, anon denial, no identity parameter and no role writes.
- Hosted database verification: permanent super_admin role, linked profile, 27 authorized products, public drafts hidden, no frontend role-update privilege.
- Browser: logged-out Products route correctly redirects to login preserving returnTo. Owner-session Products/Dashboard access, interactions and responsive verification remain pending.
- Hosted archive write: not performed; all current products are unallocated drafts.

The existing large-main-bundle warning remains; no warning was suppressed. No frontend hosting deployment was performed.

## 16–17. Database changes and blockers

NEW TABLES = 0. NEW COLUMNS = 0. NEW SCHEMAS = 0. MIGRATIONS = 0. No grants, policies, functions or Auth settings changed. The only intentional hosted data mutation was the requested existing user's super_admin role assignment (with the existing audit trigger recording it).

No schema expansion is required. Existing permanent archive and full-run-allocation restrictions are respected. The remaining verification dependency is a real owner browser sign-in; no credentials or substitute users will be created to bypass it.

## 18. Next phase

After final Phase 2A browser verification and acceptance, the recommended next task is Phase 2B Product Editor. No Phase 2B fields or Inventory module were implemented.
