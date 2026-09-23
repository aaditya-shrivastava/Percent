# Percent — Complete Project Documentation

Updated: 18 September 2026

This is a consolidated handoff for the Percent project as it exists in this workspace, including uncommitted work. It covers the storefront, backend, administration, inventory, checkout, verification history, and remaining work. The latest detailed completion report is Admin Phase 4C, dated 16 September 2026.

**Current position:** Percent has a connected storefront and substantial admin functionality, including product editing, production allocation, inventory adjustments, publication controls, order administration, and customer checkout reservations. It is not yet a complete payment-enabled commerce system. Razorpay, courier integration, and conversion of reservations into paid sales remain unfinished.

## 1. Scope and evidence

This document is based on source files, migrations, test scripts, Git history, and the reports in `docs/backend`. No hosted database query, production mutation, deployment, or application test was performed while writing this document. Historical test results below are attributed to the existing reports; they are not new verification claims.

Earlier phase reports describe the project at their own completion dates. Statements such as “no admin,” “checkout unavailable,” or “customer orders are previews” are superseded by later source and Phase 4C. The existing root README still describes the initial frontend-only foundation and is outdated.

## 2. Product and business model

Percent is a limited-edition apparel storefront, centered on designs with configurable production runs, size/colour variants, and individual physical inventory units.

- Currency is INR. Database money fields use integer paise; storefront catalog models convert prices to rupees.
- Each design has its own `production_limit`. The default is 100, but the model supports other limits such as 250 or 1,000.
- Historically produced, currently available, withdrawn, reserved, and sold pieces represent different facts.
- Withdrawn pieces still count toward historical production; withdrawal does not create permission to exceed the run limit.
- Published design identity and edition commitments are protected by database rules.
- Historical orders preserve item and delivery-address snapshots rather than depending on the current catalog.

## 3. Technology stack

| Layer | Current implementation |
| --- | --- |
| Application | React and TypeScript, client-rendered SPA |
| Routing | React Router |
| Build | Vite with React and Tailwind Vite plugins |
| Styling | Storefront CSS, isolated admin CSS, module-specific admin styles; Tailwind dependency available |
| Icons | Lucide React |
| Backend | Supabase PostgreSQL, Auth, Storage, and Edge Functions |
| Browser SDK | `@supabase/supabase-js` pinned to `2.99.1` |
| Type checking | TypeScript `~5.9.3` |
| Linting | ESLint with TypeScript, React Hooks, and React Refresh rules |
| Database tests | PGlite `0.5.8`, migration-chain scripts and hosted test scripts |
| Backend tooling | Separate `supabase/package.json`, including Supabase CLI `2.117.0` |

Several frontend dependencies use `latest` in `package.json`; use the lockfile for reproducible installation.

## 4. Repository layout

```text
Percent/
├── src/
│   ├── App.tsx                 Storefront routing and lazy admin branch
│   ├── main.tsx                Application entry point
│   ├── index.css               Storefront styling
│   ├── admin.css               Admin shell and shared styling
│   ├── backend/                Supabase client, catalog, reviews, checkout
│   │   └── admin/              Admin adapters and domain models
│   ├── components/             Layout, products, account, admin, blog, sections
│   ├── data/                   Content, presentation models, legacy fixture sources
│   ├── hooks/                  Session, cart, wishlist, addresses, orders, access
│   ├── pages/                  Customer-facing pages
│   │   └── admin/              Dashboard, products, inventory, orders
│   └── types/                  Shared frontend types
├── public/images/              Authentication artwork
├── scripts/                    Catalog preparation and frontend model tests
├── supabase/
│   ├── migrations/             Database implementation history
│   ├── functions/              Product/review media Edge Functions
│   ├── seed.sql                Initial catalog/content seed
│   ├── test-fixtures/          Small media verification fixtures
│   └── test-*.mjs              Local and hosted backend verification
├── docs/backend/               Phase audits, handoffs, reports, JSON evidence
├── dist/                       Generated production output
└── PERCENT_PROJECT_DOCUMENTATION.md
```

Root-level generated design images are also present as visual references. Legacy data and page files are not necessarily part of the active user journey; current routing and backend adapters determine behavior.

## 5. Storefront route map

| Route | Purpose |
| --- | --- |
| `/` | Homepage and featured catalog sections |
| `/shop` | Product browsing and filters |
| `/search` | Search experience |
| `/products/:slug` | Product details, variants, gallery, reviews, cart interaction |
| `/sold-out-designs` | Archive/sold-out design presentation |
| `/cart` | Browser-persisted cart |
| `/checkout` | Authenticated order and inventory reservation |
| `/login`, `/register` | Email/password account access |
| `/forgot-password`, `/reset-password` | Recovery request and password update |
| `/profile` | Customer account and profile |
| `/profile/orders` | Owner-scoped order list |
| `/profile/address` | Saved delivery addresses |
| `/profile/wishlist` | Account wishlist |
| `/orders/:orderId` | Customer order details; checkout links use the public order reference |
| `/orders/:orderId/track` | Stored order/tracking information |
| `/about` | Brand content |
| `/blog`, `/blog/:slug` | Published articles and article details |
| `/contact`, `/faq` | Support form and FAQs |
| `/policies/shipping`, `/policies/returns` | Shipping and returns content |
| `/policies/privacy`, `/policies/terms` | Privacy and terms content |

Compatibility routes:

- `/order-confirmation` redirects to `/profile/orders`; the old success-style confirmation page is not the active checkout destination.
- `/product/:slug` and `/collection` redirect to `/shop`.
- `/collection/limited`, `/collection/regular`, and `/collection/trending` redirect to tag-filtered shop views; regular currently maps to `best-seller`.
- `/collection/sold-out` redirects to `/sold-out-designs`.
- `/privacy` and `/terms` redirect to their policy pages.
- `/design/:slug` and unmatched storefront routes render `ComingSoonPage`.

## 6. Customer functionality and data ownership

### Catalog and content

`src/backend/catalog.ts` loads visible active/archived products, variants, galleries, colours, tags, aggregate inventory, approved reviews, and published blog content. `StorefrontBootstrap` initializes the storefront separately from admin and refreshes catalog data for signed image delivery. Failed startup reads produce a retry state instead of silently replacing live data with demo products.

Product prices and variant prices are converted from database paise into rupees in the catalog adapter. Stock is based on the backend aggregate read surface. Physical unit identifiers are not public catalog data.

Brand, FAQ, policy, support, and other presentation content also exists in `src/data`; the project does not yet have a complete website-content admin editor.

### Authentication and profile

Supabase Auth provides email/password registration, login, logout, account confirmation handling, password recovery, and password updates. Profile name and phone changes persist to owner-scoped records. Profile email remains Auth-owned. Old demo session keys are removed.

Google/social login is not implemented in the current Auth page. Production email delivery, redirect configuration, and full real-user recovery acceptance remain operational checks.

### Addresses and wishlist

Addresses belong to the authenticated account. `save_address` handles default-address changes transactionally. Wishlist rows persist in Supabase per customer; guests are directed to sign in.

### Cart

Cart lines contain product ID, variant ID, and quantity. They persist in browser `localStorage` under `percent-cart`; this is not a server-synchronized cart. Current catalog data resolves names, images, prices, and availability.

### Reviews and media

Authenticated customers can submit reviews with pending moderation status. Public catalog reads expose approved reviews. The review-media function handles ownership checks, pending-review restrictions, image validation, bounded image counts, private storage, cleanup, and signed public delivery after publication checks.

The moderation admin route remains a placeholder despite the existence of review submission and backend moderation fields.

### Contact form

The contact page validates input and changes to a success state after a timer. It does not currently send an inquiry to an email provider, ticket service, or database. Treat its submission behavior as a frontend simulation.

## 7. Admin panel

Admin is lazy-loaded and uses a separate shell from the storefront. Access requires a validated Supabase identity and a protected role of `admin` or `super_admin`. The guard revalidates access; database RLS and RPC checks remain authoritative.

| Route | Current functionality |
| --- | --- |
| `/admin` | Real dashboard reads, period filters, metrics and empty states |
| `/admin/products` | Product list and management entry points |
| `/admin/products/new` | New draft editor |
| `/admin/products/:id/edit` | Draft editing, media and production/publication workflows |
| `/admin/inventory` | Inventory overview |
| `/admin/inventory/:id` | Design inventory, adjustments, history |
| `/admin/orders` | Orders, metrics, search, filters, sorting and pagination |
| `/admin/orders/:id` | Order snapshots, allowed lifecycle actions and history |

The following routes exist but render placeholders: `customers`, `reviews`, `website`, `blog`, `coupons`, `analytics`, `users`, `settings`, and `media`. Global appearance/navigation links route through website settings placeholders. Unknown admin paths remain inside the guarded shell.

### Dashboard

The dashboard reads actual products, orders, profiles, inventory and review data. Revenue uses paid, completed orders. Registered Accounts includes staff. Production metrics use each design's configured limit. Unsupported historical comparisons and administrative activity are not fabricated.

### Product editing and publication

Draft persistence runs through `save_product_draft`, with optimistic concurrency using `expected_updated_at`. Conflict handling uses `PT409`, preserves the need to reload current state, and avoids silent overwrite. Product media has a dedicated Edge Function and private Storage workflow.

Production allocation and product publication are separate operations. Publishing uses `publish_product` and rechecks identity, role, lifecycle, version, product/variant readiness, primary image readiness, allocation, inventory, and the configured production limit under database locks. Later media migrations extend/correct publication readiness for uploaded private Storage images.

Active/archived products cannot simply be reset to draft. Publication capability exists, but a real positive hosted launch and storefront image acceptance were still outstanding in the saved launch-gate report.

### Inventory

`allocate_product_run` assigns physical units to variants within the design's production limit. `adjust_variant_inventory` is the controlled manual adjustment path. Adjustment UI includes a reason, optional internal note, before/after quantities, stale-write handling, and a read-only history.

Logical adjustment operations and per-unit events commit atomically. Browser direct inventory writes are restricted. Sold history and historical production limits must remain intact.

### Orders and lifecycle

Admin order lists support search, status filters, sorting, bounded 25-row pages, desktop tables and mobile cards. Details show stored customer/item/address snapshots and monetary totals.

The lifecycle model separates:

| Dimension | Schema values |
| --- | --- |
| Order | `pending`, `confirmed`, `cancelled`, `completed` |
| Payment | `unpaid`, `pending`, `paid`, `failed`, `partially_refunded`, `refunded` |
| Fulfillment | `unfulfilled`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `returned` |

Implemented admin operations include pending-to-confirmed, eligible cancellation with a reason, confirmed-order preparation, and evidence-gated completion. They are not arbitrary status edits. Cancellation checks payment and shipping conditions. Completion requires real payment and delivery evidence. Admin cannot manually mark payment paid or invent shipment references.

`update_order_lifecycle` writes immutable history atomically with the transition and rejects stale changes. Cancellation does not automatically refund payment, restore sold stock, or cancel a courier shipment.

## 8. Checkout reservation — latest implemented phase

The active checkout creates an actual pending order through `create_checkout_order`; it does not process payment.

1. A signed-in customer adds available variants to the local cart.
2. Checkout loads addresses owned by that account.
3. The browser submits variant IDs, quantities, an owned address ID, and an idempotency UUID.
4. The server validates ownership and catalog/stock eligibility, derives prices and totals, and reserves exact physical units transactionally.
5. The response shows an order reference, `pending`, `unpaid`, `unfulfilled`, and a reservation expiry.
6. The cart remains intact. Customer orders and admin orders can read the stored order through their respective access rules.

Current server policy uses a **15-minute reservation**, free shipping, and zero checkout discount/tax fields. Coupons are visibly unavailable. Reservation does not set inventory `sold_at` and does not mean payment succeeded.

Identical retries with the same owner/key/request return the same order. A changed request with a reused key is rejected. The browser stores its attempt fingerprint/key in `sessionStorage` under `percent-checkout-attempt` and enables a fresh attempt after expiry. Expired reservations become non-blocking for subsequent checkout allocation.

The implementation uses row locks, `SKIP LOCKED`, an owner/key advisory lock, and uniqueness constraints. True positive hosted multi-customer contention and the first real customer checkout were deferred in the Phase 4C report.

## 9. Supabase architecture

Configured project reference: `gijyjdeohvdrnvqfqdha`. Existing reports identify it as Percent in `ap-south-1`. `src/backend/client.ts` contains the project URL construction and browser publishable key. This document does not duplicate credentials or assert current hosted health.

### Main data groups

| Group | Tables |
| --- | --- |
| Identity | `profiles`; protected `private.user_roles` |
| Catalog | `categories`, `colours`, `tags`, `products`, `product_tags` |
| Variants/media | `product_variants`, `product_images`, `variant_images` |
| Physical stock | `inventory_units`, `inventory_adjustments`, `inventory_adjustment_operations` |
| Customer data | `addresses`, `wishlist_items`, `product_reviews`, `review_images` |
| Commerce | `coupons`, `orders`, `order_items`, `order_addresses` |
| Order operations | `order_lifecycle_history`, `checkout_reservations` |
| Editorial | `blog_posts`, `blog_sections`, `blog_images` |
| Audit | `private.audit_logs` |

Table existence does not imply a completed frontend feature. Coupons, for example, have schema support without enabled checkout redemption.

### Main RPCs

| RPC | Responsibility |
| --- | --- |
| `catalog_stock` | Public-safe aggregate stock |
| `save_address` | Owned address save and default handling |
| `get_my_role` | Caller-only protected role read |
| `save_product_draft` | Validated draft persistence |
| `allocate_product_run` | Controlled production allocation |
| `adjust_variant_inventory` | Audited stock adjustment |
| `publish_product` | Readiness-gated product activation |
| `update_order_lifecycle` | Restricted transitions and immutable history |
| `create_checkout_order` | Order snapshots, totals and inventory reservation |

### Security and media boundaries

- Customer data is owner-scoped; admin access relies on protected role data rather than editable user metadata or a browser role flag.
- Browser roles cannot freely mutate orders, physical stock, reservation rows, or immutable histories.
- Privileged RPCs have internal identity/role checks, restricted grants, fixed search paths, validation and concurrency controls.
- `checkout_reservations` has RLS and no browser table access; the RPC is the customer entry point.
- Product, blog and review image buckets were documented as private. Product/review delivery uses appropriate signed access or retained external image references.
- `percent-product-media` and `percent-review-media` live under `supabase/functions`.
- Hosted Edge Functions use server environment credentials where required; the frontend client uses a publishable key.
- Saved security reports include disabled leaked-password protection and notices for intentionally authenticated privileged RPCs. Their current state needs a fresh launch review.

## 10. Migration and development history

| Migration | Purpose |
| --- | --- |
| `20260912112058_percent_foundation.sql` | Core schemas, tables, roles, RLS, inventory and audit foundation |
| `20260912151513_percent_phase2.sql` | Catalog aggregate reads and customer integration support |
| `20260912152850_percent_review_cleanup.sql` | Review cleanup controls |
| `20260913055301_percent_get_my_role.sql` | Caller-only admin-role resolution |
| `20260913161109_admin_product_draft_save.sql` | Draft save RPC |
| `20260914000242_admin_product_conflict_signal.sql` | Draft stale-write conflict correction |
| `20260914055113_admin_production_allocation.sql` | Production allocation |
| `20260914105526_admin_inventory_adjustments.sql` | Controlled adjustments and operation history |
| `20260915025947_admin_product_publication.sql` | Product publication gate |
| `20260915130509_admin_order_lifecycle.sql` | Lifecycle actions and immutable history |
| `20260915134912_percent_active_product_media.sql` | Storefront media/publication integration |
| `20260915140502_percent_media_gate_correction.sql` | Image signing/publication correction |
| `20260916090000_percent_checkout_reservation.sql` | Checkout identity, exact-unit reservation and shipping policy |

Recorded progression: storefront work → backend foundation/customer integration → Admin Phase 1 dashboard/access → Phase 2 products/editor/media → Phase 3 inventory/allocation/adjustments/publication → Phase 4A order reads → Phase 4B lifecycle → Phase 4C customer checkout reservations.

Some hosted migrations were executed manually and others through a connector. Existing reports warn that migration history must be reconciled before a future deployment. Do not blindly replay the foundation against the existing project. Historical CLI commands in handoff reports should be checked against the installed CLI before use.

The latest inspected commit was `e11c1ea` dated 16 September 2026. This documentation also includes subsequent working-tree checkout/account changes and the untracked Phase 4C report; it is not limited to committed history.

## 11. Local setup and verification commands

Use a modern Node.js release compatible with the locked Vite version. The model scripts import TypeScript directly, so their execution also needs Node TypeScript-stripping support.

From the repository root:

```powershell
npm ci
npm run dev
```

Production checks and local preview:

```powershell
npm run lint
npm run build
npm run preview
```

The current browser client is bound directly to the existing Supabase project; starting the frontend is not an isolated local database setup. Review scripts before executing hosted tests, seeds, account provisioning, or migration tools.

Frontend domain/model scripts include:

```powershell
node --experimental-strip-types scripts/test-admin-foundation.mjs
node --experimental-strip-types scripts/test-admin-products.mjs
node --experimental-strip-types scripts/test-product-editor.mjs
node --experimental-strip-types scripts/test-admin-inventory.mjs
node --experimental-strip-types scripts/test-inventory-adjustments.mjs
node --experimental-strip-types scripts/test-admin-orders.mjs
```

Install the separate backend test dependencies with `npm ci --prefix supabase`. Local migration-chain suites include:

```powershell
node supabase/test-local.mjs
node supabase/test-role-rpc.mjs
node supabase/test-product-draft-rpc.mjs
node supabase/test-product-allocation.mjs
node supabase/test-inventory-adjustments.mjs
node supabase/test-product-publication.mjs
node supabase/test-admin-orders.mjs
node supabase/test-order-lifecycle.mjs
node supabase/test-checkout-foundation.mjs
```

Hosted/media/launch scripts and SQL fixtures are additional verification tools, not a single unattended test command. They may need credentials, prepared users, hosted configuration, or authorized data changes. PGlite coverage uses Auth/Storage shims and does not substitute for hosted end-to-end acceptance.

## 12. Recorded verification and hosted-state limits

The Phase 4C report records passing TypeScript/build, lint, diff checks, checkout foundation, order RLS/lifecycle, publication, allocation/adjustments, and draft/role regression suites. Its browser smoke check covered the real empty-cart state without creating a hosted order.

Prior admin reports document responsive checks down to 320 px, keyboard/focus behavior, loading and error states, stale edits, and owner/admin/anonymous access boundaries. Populated order UI and mutation tests often used local fixtures because hosted orders were empty.

Saved hosted snapshots must be interpreted by date:

- Initial Phase 2 seed: 27 draft products, 216 variants, and 9 blog posts; this is seed history, not a current catalog count.
- Later Phase 4B evidence: 31 products, no active/visible products, 269 inventory units, and a permanent owner `super_admin` account.
- Phase 4C structural readback: orders, items, reservations, addresses and sold inventory remained zero during that verification; no hosted customer order was submitted.
- Launch Gate 1: negative privacy checks passed, but positive anonymous signing of visible active/archived images was not exercisable with the hosted data then available.

No current live counts or frontend production deployment are certified by this document. Existing reports also retain a non-failing Vite warning for the main JavaScript chunk exceeding 500 kB.

## 13. Open issues and remaining work

### Immediate acceptance and correctness

1. Complete a real product publication acceptance flow with approved content, prices, variant allocation, physical stock and uploaded primary imagery.
2. Verify anonymous active-product image delivery on Home, Shop and Product Details; verify archived image delivery when a legitimate visible archived product exists.
3. Complete the Phase 4C real-customer checkout acceptance procedure, including owner/admin order visibility, exact stock reservation, idempotent retry and expiry.
4. Review a monetary display inconsistency found while documenting: `CheckoutPage.tsx` passes server `*_paise` totals directly to `formatInr`, which formats rupees, while catalog preview prices are already rupees. This appears capable of displaying authoritative reservation totals at 100 times their intended rupee amount. It was identified by source inspection, not reproduced or fixed in this documentation task.
5. Recheck stock presentation and admin actions while reservations are active. Checkout reservation correctness alone does not prove that every existing stock display or adjustment path accounts for holds consistently.

### Commerce completion

- Implement the planned Phase 4D payment integration, including trusted payment verification, webhook idempotency, failure/expiry handling, and conversion of held units into sales.
- Implement courier/shipping integration, real tracking evidence and delivery events.
- Design refunds, returns, customer cancellation and associated stock/payment behavior.
- Implement server-authoritative coupon validation before enabling promo-code entry.
- Connect customer transactional notifications and the contact inquiry form.

### Launch operations and future modules

- Confirm production hosting/domain, SPA route fallback, Auth Site URL and redirect allowlist, email delivery and recovery callbacks.
- Review leaked-password protection and current backend security/performance advisors.
- Reconcile hosted migration history before pushing schema changes.
- Complete placeholder admin modules according to business priority.
- Revisit catalog pagination, dashboard aggregation, review-media request volume, reporting timezone and bundle size as data grows.
- Resolve historical seed/catalog questions using real business records; do not turn old demo archive records into invented sales history.

## 14. Recommended acceptance sequence

1. Resolve the checkout money-display issue and run the relevant checks.
2. Confirm one genuine sellable product and pass publication/media acceptance.
3. Sign in as a real customer, save an address and add one available variant to the cart.
4. Create one pending order; verify free shipping, authoritative totals, unchanged cart and a temporary hold.
5. Verify the same reference in customer orders and admin orders, with no `sold_at` change.
6. Verify repeat submission returns the same order and post-expiry checkout can begin a fresh attempt.
7. Only then extend and test payment and fulfillment against that established order/reservation contract.

## 15. Detailed source reports

- [Backend foundation completion](docs/backend/completion-report.md)
- [Customer/backend Phase 2](docs/backend/phase-2.md)
- [Admin foundation](docs/backend/admin-phase-1-completion-report.md)
- [Products Phase 2A](docs/backend/admin-phase-2a-report.md)
- [Product editor Phase 2B](docs/backend/admin-phase-2b-completion-report.md)
- [Draft conflict correction](docs/backend/phase-2b-conflict-correction.md)
- [Production allocation Phase 3A](docs/backend/admin-phase-3a-completion-report.md)
- [Inventory adjustments Phase 3B](docs/backend/admin-phase-3b-completion-report.md)
- [Publication Phase 3C](docs/backend/admin-phase-3c-completion-report.md)
- [Product launch Gate 1](docs/backend/product-launch-gate1-report.md)
- [Order reads Phase 4A](docs/backend/admin-phase-4a-completion-report.md)
- [Order lifecycle Phase 4B](docs/backend/admin-phase-4b-completion-report.md)
- [Checkout reservation Phase 4C](docs/backend/admin-phase-4c-completion-report.md)

Additional audits, SQL handoffs, test JSON and advisor snapshots remain under `docs/backend`. When continuing development, use current source plus the newest applicable report; older phase boundaries are historical context.
