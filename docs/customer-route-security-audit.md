# Strict customer protected routes — implementation and acceptance

Completed October 2, 2026. Earlier UI changes in this checkout are preserved.

## Audit and implementation

Personal table RLS and authenticated checkout RPC grants already existed. The gaps were anonymous authenticated identity acceptance, Cart/Checkout mounting without a shared customer guard, an unowned global cart, incomplete return-path validation, and action checks that did not wait for authoritative restoration.

The user executed `20261002022344_customer_session_anonymous_denial.sql`. Hosted read-only function inspection confirms both `private.current_user_id()` and `provision_my_percent_identity()` exactly match the locally tested replacements. Ownership, ACLs, security definer, volatility and empty search_path are preserved. Normal Password/Google identities, legacy identities, customer/Admin/Super Admin roles and anonymous claim rejection pass disposable PostgreSQL tests. Firebase provider configuration is user-verified: Password/Google enabled, Anonymous disabled.

`CustomerRouteGuard` blocks mounting until Firebase and Percent identity/profile/role resolution completes. It redirects signed-out users with replacement history and a safe returnTo. Staff customer eligibility reuses the existing backend customer-activity predicate; staff-only accounts retain Admin access. Identity changes and logout clear the published session immediately; stale asynchronous resolutions cannot republish an old identity. BFCache restoration rechecks the authoritative session.

All existing public routes remain available: `/`, `/shop` (including fit/tag filtering), `/search`, `/sold-out-designs`, `/products/:slug`, `/product/:slug`, `/collection`, `/collection/limited`, `/collection/regular`, `/collection/trending`, `/collection/sold-out`, `/about`, `/contact`, `/faq`, `/blog`, `/blog/:slug`, `/policies/shipping`, `/policies/returns`, `/policies/privacy`, `/policies/terms`, `/privacy`, `/terms`, `/design/:slug`, and authentication/recovery pages. Existing aliases retain their destinations.

Protected routes: `/cart`, `/wishlist` (canonical redirect to `/profile/wishlist`), `/profile`, `/profile/orders`, `/profile/address`, `/profile/wishlist`, `/checkout` including its inline pending reservation, `/order-confirmation`, `/orders/:orderId`, `/orders/:orderId/track`. There is no separate payment/reservation route in the router.

`AdminRouteGuard` is unchanged. Existing Admin/Super Admin authorization remains intact. The two preview branches that previously bypassed it now use that same guard. Customer-only accounts remain denied.

Return paths must be internal, slash-prefixed and parseable. Validation rejects external/protocol-relative URLs, backslashes, controls, malformed encoding, encoded redirect tricks, normalized double-slash paths and case-insensitive authentication loops. Query/hash are preserved. Sign In/Register/Forgot Password links preserve the validated path.

Cart, wishlist and review actions require a resolved customer. Loading actions do nothing pending resolution. Logged-out actions redirect to Sign In with the public product return path. Cart storage is keyed by verified Percent UUID; old unowned cart data is discarded because its owner cannot be established. No anonymous customer/cart/wishlist state is created. Backend checkout/coupon/review adapters also check the current customer before requests.

## Acceptance matrix

| Check | Result and evidence |
| --- | --- |
| Hosted migration and identity functions | Verified deployed function bodies/metadata in `backend/customer-security-deployed-functions.json` |
| Anonymous direct personal API reads | Seven hosted endpoints denied with 42501 |
| Anonymous provision/address/checkout/coupon RPCs | Four hosted probes denied with 42501; no data mutations |
| Normal Password/Google provisioning | Passed disposable PostgreSQL mapping/profile/contact-email/idempotency tests |
| Customer/Admin/Super Admin identity resolution | Passed PostgreSQL claims tests; customer/Admin/Super Admin browser guard tests |
| Anonymous Firebase/legacy identities | Resolver returns null, provisioning rejected, no principal created |
| Own profile/address/wishlist/orders/reviews | Allowed in actual PostgreSQL RLS tests |
| Other customer's profile/address/order | Reads hidden; updates/deletes, address replacement and foreign ownership writes denied |
| Checkout address ownership | Foreign customer address rejected |
| Authenticated reservation | Real RPC creates pending unpaid reservation, server subtotal, owner-scoped idempotent replay; browser reservation disappears on logout |
| Order items and delivery snapshots | Own records readable through RLS; order ownership scopes access |
| Reservation records | Direct customer/anonymous reads denied; safe status provided by the checkout RPC |
| Anonymous review submission | RLS insert denied; approved review browsing remains public |
| Direct URL/loading | All ten protected route forms tested: private DOM/hooks do not mount before restoration |
| ReturnTo | Cart/wishlist/checkout/order login restoration and malicious URL matrix passed; alias canonicalizes wishlist |
| Refresh/back/forward/logout | Passed; restored private page waits for session, signed-out private content remains absent |
| Public browsing | Seventeen page/alias forms passed |
| Protected actions | Cart/wishlist/review require login, no anonymous storage or writes |
| Account isolation | Customer B cannot see customer A's cached cart; loading cannot mutate it |
| Admin | Customer denied; Admin/Super Admin allowed; staff customer-eligibility enforced; logged-out previews guarded |
| Responsive | Loading/Sign In overflow checks passed at 1440,1280,1024,834,768,600,426,425,390,375,360,320 |
| Accessibility | Loading role=status/aria-busy; Sign In heading receives focus; existing labels and keyboard controls retained |
| Console | No browser page errors in automated suite |
| TypeScript / ESLint / production build / git diff --check | Passed |

## Changed implementation files

- `src/App.tsx`
- `src/components/account/CustomerRouteGuard.tsx` (new)
- `src/backend/customerAccess.ts` (new)
- `src/backend/percentSession.ts`, `src/backend/firebaseSession.ts`
- `src/hooks/usePercentSession.ts`, `src/hooks/useCommerce.ts`
- `src/data/auth.ts`, `src/pages/AuthPages.tsx`
- `src/pages/ProductDetailsPage.tsx`, `src/components/product/ProductReviews.tsx`
- `src/backend/checkout.ts`, `src/backend/reviews.ts`

Header/Footer/CSS and CheckoutPage UI diffs predate this security implementation. No additional UI polish, payment integration, shipping integration, or Firebase Step 10 work was performed.

## Tests and practical limits

- `scripts/test-customer-route-security.mjs`: actual application/router/guards/session/commerce/auth UI with deterministic Firebase and HTTP boundaries; results in `backend/customer-route-security-browser-results.json`.
- `supabase/test-customer-session-preflight.mjs` and `supabase/tests/customer_session_anonymous_denial.sql`: actual PostgreSQL function and RLS execution in disposable PGlite; results in `backend/customer-session-preflight-results.json`. Product publication triggers are bypassed only while seeding the isolated catalog fixture; customer RLS remains enabled. This is not an inventory/publication suite.
- `scripts/test-customer-security-hosted-anon.mjs`: real hosted anonymous HTTP denials, recorded in `backend/customer-security-hosted-anon-results.json`.
- Hosted policies/functions inspected read-only: `backend/customer-security-hosted-authorization.json`.

Live Firebase password credentials and Google OAuth popup/consent were not exercised. Authentication UI return paths were tested with deterministic provider boundaries; provider claims/provisioning/role behavior was tested in PostgreSQL and compared with deployed functions. No hosted test identities were created and no authenticated hosted records were mutated. The optional older `supabase/test-checkout-foundation.mjs` fails in its pre-existing Auth shim (`auth.users.created_at` missing); the new current-migration suite covers authenticated checkout and reservation directly and passes. No implementation blockers remain; these are validation scope limits.