> Historical Phase 1 report. Superseded by [Phase 2](phase-2.md): the verified target is gijyjdeohvdrnvqfqdha, and production_limit is configurable per design (default 100). The former exact-100 rule was removed before hosted deployment.

# Percent backend foundation — local preparation

Status: **implemented and tested locally; not connected or deployed**.

The user explicitly postponed creating/connecting Supabase during this task. No hosted database, Auth configuration, Storage bucket, key, function, or migration was changed. `spacetees` was never queried at the database level or modified. No project URL/key was added to the frontend.

## Project isolation and deployment gate

Read-only project discovery found only `spacetees` (`psqufkcrzybjvkxxpnkq`) in organization SpaceTees (`kzwxqbmahnsippihpqbd`). This reference is a **forbidden target**, not a connection setting. Percent does not yet have a verified reference. The initial creation quote was $0/month; it must be checked again if creation is requested later.

Future deployment must first verify all of:

1. Dashboard/API project name is exactly `Percent`.
2. Organization is `SpaceTees`; region is `ap-south-1`.
3. The separately recorded project ref is not the forbidden reference above.
4. API URL, Auth, Storage, credentials and migration history belong to that same new project.
5. The initial application schema is empty. The migration refuses existing public application tables.

Record `ACTIVE PROJECT = Percent` and the verified ref before any remote write. If anything is uncertain, stop. There is intentionally no linked project file or remote deployment command/script. SQL cannot determine the dashboard's project name by itself.

## Frontend audit

Read `src/types/index.ts`, catalog/homepage/archive/details modules, commerce/session/address hooks, review component, account/order-confirmation modules, checkout/cart pages, and blog/auth modules. `catalog-audit.json` is a generated full snapshot of the actual data, including nonpublic records and archive clones. Regenerate it with `node scripts/audit-catalog.mjs` from the repository root.

| Domain | Observed model and decision |
|---|---|
| Products | 12 homepage products plus 15 shop additions = **27 catalog products**. Public shop filters expose 24. Preserve all 27 names, IDs as `legacy_id`, and slugs. |
| Prices | Homepage has USD prices 40–56; shop overrides shared products with INR prices. Use the shop/details INR values, multiplied by 100. No FX conversion. |
| Variants | Details creates **216 variants**, 8 per product: two generated colours × S/M/L/XL. Shop cards show one colour; seed follows the actual detail-page options. |
| Colours | Stone (`stone`), Soft Ivory (`ivory`), Charcoal (`charcoal`), Burgundy (`burgundy`), Taupe Grey (`taupe`), preserving swatches. |
| Category and fit | One actual category, `t-shirts`. `standard` and `oversized` are product fit values. Homepage fit collections are computed placements; no independent collection table yet. |
| Tags | Seven: `limited-edition`, `artist-collaboration`, `best-seller`, `trending`, `new`, `minimal`, `graphic`. Preserve group, filtering, active and ordering metadata. |
| Decorative design links | Quotes, Landscapes, Abstract, Minimal homepage cards have no explicit product membership. Do not manufacture assignments. |
| Images | Unsplash references plus generated role/order/size/alt metadata; preserve product gallery and per-variant gallery order with relations. Do not download/copy remote imagery. |
| Stock | **26 of 27** products have variant stock totals inconsistent with remaining design stock. Afterimage claims 1 remaining but exposes 6 available units across variants. No generated stock is imported. |
| Sales | `salesCount` is a demo sorting field, sometimes >100; `soldPieces` and `editionSold` are separate, conflicting fields. Do not treat sorting counts as sales. |
| Sold out | `studio-mark-tee` is sold out in shop, despite different homepage edition counters. Retain the source snapshot, but do not fabricate 100 historical sales. |
| Nonpublic | `internal-draft-tee`, `archived-campaign-tee`, `private-sample-tee`; the latter is published but invisible. Seed all catalog rows as invisible drafts regardless of source presentation state. |
| Archive | **8 extra demo clones / 64 variants** use `archive-` IDs/slugs, copying designs also in the shop. They are not 8 verified new production runs. Preserve their original URLs/data in the audit only; do not seed them as distinct saleable designs. |
| Cart | Local storage `percent-cart`: `{productId, variantId, quantity}`. No server cart requirement; defer cart tables. |
| Wishlist | Local storage product-ID array. Use a single `(user_id, product_id)` relation; a separate wishlists table adds no present value. |
| Reviews | Rating 1–5, optional 100-character title, required 1–1200 character text, display name/date/status. Maximum 3 JPG/PNG/WebP images, 5 MB each. UI immediately publishes and only guards duplicates in memory; backend defaults to pending, uses unique user/product and column privileges. No demo reviews imported. |
| Profile/Auth | Demo local-storage session with display/first/last name, phone/email/memberSince. Backend profile ID references `auth.users`; email remains Auth-owned, memberSince derives from creation time. No passwords or metadata-derived roles. |
| Addresses | ID, label/default, fullName, phone, lines 1/2, city, state, pinCode, country. Indian six-digit PIN and `IN` country; one default at most per user. Switching defaults must be transactional in Phase 2. |
| Orders | Three fixture orders plus a session confirmation; mock variant IDs may not exist. They claim Razorpay paid/confirmed despite no payment. Import none. Real schema starts unpaid/unfulfilled and preserves item/address snapshots. |
| Coupons | Checkout input only; discount always zero, no implemented codes. Empty constrained coupons table for planned administration; no validation/redemption service. |
| Blogs | **9 posts**, 5 categories (Brand, Design, Style, Process, Community), stable slugs, author/date, excerpt/introduction, ordered sections/paragraphs, pull quote, primary/secondary images. Seed as drafts. |
| Content | Hero banners/navigation/policies are existing static UI content. Keep them static; defer generic content/settings/banner tables until editorial requirements exist. |

The 8 archive URLs are `archive-studio-mark-tee`, `archive-afterimage-tee`, `archive-night-signal-tee`, `archive-parallel-lines-tee`, `archive-edition-no-09-tee`, `archive-common-ground-tee`, `archive-quiet-geometry-tee`, and `archive-soft-focus-tee`. No frontend route changed. Before migrating the archive UI, decide whether these are demo-only URLs, redirects to canonical designs, or genuine historical records with independent evidence. Do not silently delete/change routes during Phase 2.

## Schema and relationships

The migration defines 22 public tables, two private tables, and two server-only aggregate views.

| Parent | Children / relationship |
|---|---|
| `auth.users` | 1:1 `profiles`; 1:1 private `user_roles` |
| `profiles` | 1:N `addresses`, `wishlist_items`, `product_reviews`, `orders` |
| `categories` | 1:N `products` |
| `products` | 1:N `product_variants`, `product_images`, `inventory_units`, `product_reviews` |
| `products` ↔ `tags` | M:N through `product_tags` |
| `colours` | 1:N `product_variants`; size belongs to variant |
| `product_variants` ↔ `product_images` | M:N ordered `variant_images`, composite FKs prevent cross-product images |
| `inventory_units` | 1:N append-only `inventory_adjustments` |
| `product_reviews` | 1:N `review_images`, unique slots 1–3 |
| `orders` | 1:N immutable `order_items`, 1:N immutable `order_addresses` by kind |
| `blog_posts` | 1:N ordered `blog_sections`, 1:N `blog_images` by role |
| Operational tables | Append-only private `audit_logs` stores actor, operation, table, row ID and time |

`coupons` stands alone pending redemption integration. Roles and audit logs live in an unexposed private schema. No banners, analytics, settings, payment attempts, shipments, notification, coupon-redemption, or cart tables are invented in this phase. Split payments/shipments into event/attempt tables when the provider workflows are specified.

Blog paragraphs use JSONB because they are an ordered editorial text payload, not relational entities used for filtering. Product tags, images, variants and all core customer/order fields remain relational. Audit inventory snapshots also use JSONB appropriately.

UUIDs identify entities; product/blog slugs and design codes are unique. Composite keys identify joins. FKs have explicit cascade/restrict/set-null behavior. Mutable entities have updated timestamps; immutable snapshots/joins have creation timestamps. FK indexes, filtered listing indexes and user/order-history indexes support expected access paths. Initial generic FK indexes favor complete coverage; remove proven redundant indexes after measuring a real workload.

## Inventory and lifecycle

`draft → active → archived`, with permanent `sold_out_at` distinguishing fully sold editions from manually retired designs. A temporarily unavailable size is represented by zero available units for that variant, without declaring the entire design sold out. An early archive need not claim all pieces sold.

For a limited design, `total_produced` must equal 100. Each physical piece gets an immutable identity `(product_id, piece_number)`, where piece number cannot exceed the fixed run. All production units must be allocated to variants before activation or archiving. Draft rows describe intended runs, so `total_produced=100` in a draft is **not evidence that production has occurred**; `allocated_pieces=0` makes this explicit in the seed.

Units cannot be deleted or reset after sale/withdrawal. Design code, slug, limited flag and run size are immutable. A trigger serializes inventory mutation against the product row and checks allocation boundaries; this is inventory integrity, not a checkout/order lock or reservation flow. The last sale automatically sets archived/sold-out timestamps. An archived design cannot reopen. Inventory changes are recorded in an immutable adjustment log.

The two security-invoker views report allocated/sold/remaining/withdrawn counts by design and variant. They are server-only to avoid exposing physical-unit details. A safe public catalog aggregate adapter is Phase 2. Draft allocations and withdrawn units are not necessarily saleable: the adapter must combine active status and variant enabled flags with counts.

A sale endpoint, reservation expiry, idempotency, payment confirmation, refund/return accounting, and multi-session oversell tests are deliberately absent. Even server-only data mutation must use a future transactional service. A returned limited piece cannot simply clear `sold_at`; approve a resale/returns policy before implementing it. Creative duplication under an entirely new design code requires an admin approval/asset-identity workflow; a database cannot recognize copied artwork by name alone.

The run is fixed for non-limited products too in this initial design, while the exact-100 constraint applies only to limited products. Any future replenishable essentials policy needs a deliberate production-run extension rather than editing sold history.

## Money and order history

Prices use integer paise, e.g. ₹1,299 = 129900. Order sums use bigint paise. No floating-point monetary column exists. Percent coupons use integer basis points, 10000 = 100%. CHECK constraints enforce nonnegative amounts, valid discounts, and header arithmetic.

Order items retain product name/slug, SKU, size, colour, image URL, unit price and quantity; line totals are generated from stored values. Order addresses are independent copies and do not reference a mutable customer address. Both snapshot tables reject updates/deletes. Product references are optional for historical flexibility but restrict deletion when present; variant/product combinations must agree.

Future order creation must atomically calculate totals from authoritative prices, snapshot items/addresses, reconcile header totals to item totals, and link sold units to order items. Phase 1 does not claim that its bare order tables constitute a complete checkout engine. Image references currently use external URLs: durable copied assets will be needed for durable historical image delivery.

## Security matrix

| Role | Access |
|---|---|
| Public | Visible active/archived catalog and images/options/tags; published nonscheduled blogs; approved reviews and their image metadata. No private customer/order/inventory data. |
| Customer | Own profile reads and display/contact edits; own addresses; own wishlist; insert/edit/delete own pending reviews; read own orders/snapshots. No operational writes or role assignment. |
| Admin / super_admin | Protected database role gives catalog/content/coupon management and operational reads. No client inventory/order writes, review approval or role assignment in this foundation. Both roles currently share the small allowed surface; granular permissions are a later addition. |
| Server role | Trusted operational access. Must remain server-only. Initial admin role assignment is a separately authorized server/database operation, never user metadata. |

Every application table has RLS and explicit grants. Private role lookup is security-definer solely to read protected roles; it checks `auth.uid()`, has an empty search path and revoked PUBLIC execution. Auth bootstrap ignores supplied metadata and creates only a default customer. Other definer functions are revoked trigger helpers for internal audit work. No public RPC or password table exists.

Role changes and key operational changes record audit metadata without copying customer PII into general audit logs. Inventory logs contain unit state, not address/contact data. Audit retention and account deletion/export requirements need implementation before launch; FKs deliberately retain order snapshots while removing direct customer linkage when a profile is deleted.

## Storage plan

The migration would create three **private** buckets: `percent-product-images` (10 MB), `percent-review-images` (5 MB), `percent-blog-images` (10 MB), restricted to JPEG/PNG/WebP. These buckets have **not** been created remotely. No browser Storage policies exist, so customer uploads and direct delivery remain disabled. No banner bucket until it is needed.

Phase 2 must implement ownership-checked upload paths, server-verified MIME/content, review-image row ownership, moderation, maximum 3 files, cleanup, and signed delivery. Approved review assets may be served only after parent publication checks. Decide whether approved catalog/blog copies should move to a separate public bucket or use a controlled delivery endpoint. Draft imagery must never become public accidentally.

## Seed strategy and status

`node scripts/prepare-seed.mjs` produces `supabase/seed.sql` from the audited frontend snapshot. Deterministic UUIDs plus `legacy_id` bridge current string IDs. The repeatable seed adds 27 invisible draft products, 216 variants, 7 tags, 5 colours, 1 category, galleries and variant ordering, and 9 draft posts with sections/images. It never overwrites existing edited rows (`ON CONFLICT DO NOTHING`). Therefore it is a one-time bootstrap, not a synchronization/update mechanism.

No inventory units, customers, addresses, reviews, orders, fake paid records, coupons, or cloned archive production runs are inserted. Source demo totals and clone URLs remain in the audit report. This seed was executed twice only in the disposable local test database; no hosted import occurred.

Approval is needed before publishing/importing real inventory: confirm authoritative INR prices, generated secondary colours, variant production allocations, historical Studio Mark sellout, archive URL treatment, and whether all designs should be limited despite the existing frontend flags. These choices do not block the safe draft foundation.

## Verification and reproduction

From the repository root:

```powershell
npm ci --prefix supabase
node scripts/audit-catalog.mjs
node scripts/prepare-seed.mjs
npm test --prefix supabase
npm run build
```

The backend tool package pins Supabase CLI 2.117.0 and PGlite 0.5.8 separately from storefront dependencies. The migration filename was generated with the CLI's `migration new` command. No CLI link/login/reset/push was run. PGlite executes real PostgreSQL SQL, constraints, grants, roles, and RLS in a disposable database. Auth user/UID and Storage bucket metadata are **minimal test shims**, not hosted services.

See `test-results.json` for passed groups. Coverage includes seed repeatability/counts, unique slugs, FK checks, integer money/coupons, public/draft visibility, profile/address/wishlist isolation, pending review ownership/moderation, role escalation denial, admin access, snapshot immutability, 100-piece allocation and retirement, append-only logs, RLS presence and private bucket metadata.

Still required after connecting the verified Percent project: migration replay in real Supabase, generated database TypeScript types, security/performance advisors, real anon/customer API tests, Auth signup/profile trigger integration, Storage authorization tests, and concurrent-session inventory tests. PGlite cannot validate those hosted boundaries. Do not describe Phase 1 as hosted-verified until these checks pass.

## Files added

- `docs/backend/phase-1.md`: audit, architecture, relationship plan and handoff.
- `docs/backend/catalog-audit.json`: current frontend data snapshot and discrepancy report.
- `docs/backend/test-results.json`: local database test result summary.
- `scripts/audit-catalog.mjs`, `scripts/prepare-seed.mjs`: reproducible extraction and draft seed generation.
- `supabase/migrations/20260912112058_percent_foundation.sql`: schema, constraints, indexes, RLS, triggers and future private buckets.
- `supabase/seed.sql`: safe draft seed.
- `supabase/test-local.mjs`, `supabase/package.json`, `supabase/package-lock.json`, `supabase/.gitignore`: isolated local test tooling.

Existing frontend source files and user changes were preserved. No Supabase frontend client or credentials were introduced.

## Stop point and recommended Phase 2

Wait for the user's approval to connect/create the isolated Percent project. Verify/deploy/test this foundation there first, resolve catalog/inventory decisions, then add Supabase Auth and a catalog/customer adapter incrementally. Keep frontend demo data until each flow is verified. Admin UI, Google provider setup, real checkout, Razorpay, Delhivery, production order creation, email/SMS, notifications, and analytics remain unimplemented.

References consulted: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control). The changelog Markdown fetch was attempted but blocked by tool content-type/network limitations; verify release notes again before hosted rollout.
