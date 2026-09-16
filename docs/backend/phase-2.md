# Percent backend Phase 2

Implemented 12 September 2026. ACTIVE PROJECT = Percent, `gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`. Verified through the connector's discovered get-project capability before any hosted write. No other project was opened, queried, or modified. The old Phase 1 organization assumption is superseded by this exact verified target.

## Hosted deployment

Applied `percent_foundation`, `percent_phase2`, and `percent_review_cleanup` through the connector. Hosted migration timestamps are assigned by Supabase; local source filenames retain their CLI-generated timestamps. Do not blindly replay the foundation: its fresh-schema guard intentionally rejects an existing application database. Generated database types are in `src/backend/database.types.ts`.

The repeatable draft seed contains 27 products, 216 variants, 9 blog posts, and supporting options, images, tags and sections. No inventory or historical sales were invented. After verification, hosted profiles, reviews, inventory units and stored objects are all empty. Test accounts were signed out and removed.

## Production limits

`products.production_limit` is a positive integer with default 100. The exact-100 constraint was removed **before** foundation deployment. Admin RLS permits changing each draft design's limit, including 250 or 1000. A change cannot invalidate allocated serials or sold history. Published/archived runs remain immutable to preserve the promised edition size. To configure a future run, set its limit before activation and allocate that complete run to actual variants.

Unit serials cannot exceed their parent product's limit. The retirement trigger checks `sold_quantity >= production_limit`; it never compares to a global 100. Public inventory RPC returns product/variant aggregate counts only, explicitly filtering visible active/archived products. Available counts also require active product status, shop availability and enabled variants. Physical units remain private.

Local and hosted transaction tests cover 100, 250 and 1000 pieces, premature retirement, final-sale retirement, excess allocation and aggregate counts. Hosted inventory fixtures were rolled back. No checkout reservation or concurrent sale endpoint is claimed; that is outside this phase.

## Customer and frontend integration

- Pinned Supabase JS client, bound to the verified project with its public publishable key. No service-role key is stored in frontend source.
- Email/password sign-in, sign-up, sign-out, confirmation callback handling, recovery requests and password update screen. Old demo session keys are discarded. Protected profile reads resolve the displayed account.
- Profile name/phone updates persist through RLS. Email remains Auth-owned and read-only in profile editing.
- Addresses load per customer; `save_address` locks the customer's profile and switches defaults transactionally. Live concurrent default requests leave exactly one default. Address deletion uses ownership RLS.
- Wishlist persists per authenticated customer. Guests are directed to sign in. Cross-user requests cannot modify another customer's rows.
- Catalog, variants, galleries, prices in INR, configured production counts, approved reviews and published blogs load from hosted data. Homepage, shop, search, details, archive, cart product resolution and wishlist use that data. Startup errors show a retry screen; they never display fixture products.
- Existing archive routes remain addressable, but unverified demo archive clones are not presented as real editions. Their source records and URLs remain in the audit. They currently resolve unavailable rather than fabricating history or redirecting to a different design.
- Checkout is unavailable. Demo orders are not displayed in authenticated accounts. No real order creation, payment or shipping integration was added.

## Reviews and Storage

All three Percent image buckets remain private. Direct anonymous/customer uploads are denied. Existing product/blog imagery stays as external references; no remote imagery was copied.

The deployed `percent-review-media` Edge Function verifies write callers with Supabase `auth.getUser`, verifies review ownership and pending status, checks image signatures/MIME and the 5 MB limit, and reserves unique slots 1–3 before uploading. It cleans partial failures. Customer deletion runs through the cleanup action, which closes uploads before removing objects and review rows. Direct customer review deletion is revoked to avoid bypassing cleanup. This validates image headers, not a full image decoder or malware scan.

Public signed delivery explicitly requires an approved review and a visible active/archived parent, then reads metadata using anonymous RLS before issuing five-minute URLs. Pending images remain private. Automatic approval review initially rejected the public delivery update; the stricter explicit publication checks were added and deployment then succeeded.

`verify_jwt=false` is intentional because the function implements its own authentication for writes and serves a narrowly filtered public read action. The service-role key is read only from hosted Edge Function environment variables. It is never returned or included in the browser build.

## Verification

- 17 local PGlite PostgreSQL groups pass; local Auth and Storage boundaries remain shims.
- Live Auth password sign-in and profile bootstrap pass with two temporary, confirmed, non-deliverable test accounts inserted through SQL. No signup or recovery emails were sent during testing.
- Hosted REST verifies draft visibility, profile/role/order protections, address isolation and concurrent default switching, wishlist ownership, Storage denial, and Auth settings availability.
- Hosted review-media tests verify invalid content rejection, three real image uploads, fourth-image rejection, pending-image privacy and successful cleanup.
- Hosted SQL validates run limits and aggregates in a rolled-back transaction.
- Production build and repository lint pass. Vite reports an advisory bundle-size warning.
- Browser smoke checks cover empty shop and the real sign-in form; email delivery and password-recovery completion were not exercised.

Evidence: `test-results.json`, `hosted-test-results.json`, `security-advisors.json`, `performance-advisors.json`. Test sources are under `supabase/`.

## Remaining launch configuration and decisions

Catalog is intentionally unpublished pending the authoritative prices, variant allocations and archive-history decisions already identified in Phase 1. Confirm actual inventory before activating products. Public shop and blog pages are therefore empty.

Set the production Auth Site URL and redirect allowlist once the storefront origin is known, including `/profile` and `/reset-password`; configure email delivery before launch. The connector exposes no Auth configuration mutation tool, and no production storefront origin was supplied. Live email confirmation is enabled; delivery/callback behavior still needs an end-to-end test with an authorized real address.

Security advisor reports leaked-password protection disabled: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Performance advisories identify overlapping public/customer/admin SELECT policies and unused indexes on this new database; these do not indicate RLS bypass and should be evaluated against real traffic rather than dropping integrity-related indexes now.

The current catalog bootstrap fetches all public records (subject to Data API row limits), appropriate for this 27-product foundation. Server-side pagination and subscription-driven refresh are future scaling work. Catalog changes require a reload to refresh all sections. The frontend integration is local; no website hosting deployment was requested or performed.

Admin Panel UI, Razorpay, Delhivery, real checkout/orders, provider setup, and production inventory import remain outside this phase.
