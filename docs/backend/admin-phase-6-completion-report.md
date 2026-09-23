# Percent Admin Phase 6 — Reviews Management Completion Report

Date: 21 September 2026  
Project: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
Status: **PHASE 6 — REVIEW VISIBILITY VERIFIED**

The unrelated `spacetees` project was not accessed.

## Delivered behavior

- `/admin/reviews` uses hosted Supabase review, product, and review-image metadata.
- Metrics show Total Reviews, Shown, Hidden, New / Not Shown, and the average rating of shown reviews.
- Search covers customer, product, title, and body. Visibility, rating, sorting, and bounded pagination are supported.
- The UI consistently presents New, Shown, Hidden, Show Review, and Hide Review. Approve/Reject decision language is absent.
- Review inspection preserves customer content as read-only and links to the related customer and product.
- Review images are signed through the existing authenticated `admin_read` Edge Function path. The bucket remains private.
- Desktop, tablet, and mobile layouts were verified against the authenticated hosted session. The hosted project currently has zero reviews, so the page correctly renders the real empty state without fabricated data.

## Hosted backend verification

- `public.set_product_review_visibility(uuid,boolean,timestamptz)` exists.
- The former `public.moderate_product_review(uuid,text,timestamptz)` no longer exists.
- `PUBLIC` and `anon` have no execute permission; `authenticated` does.
- The function derives its actor from `auth.uid()`, requires `private.is_admin()`, locks the review, checks `expected_updated_at`, updates only status, and records real transitions.
- `private.review_moderation_history` remains the single immutable history system.
- Public review RLS still requires `status = 'approved'` on a visible active/archived product. Pending and hidden reviews remain absent from the storefront.

## State model

- `pending` = New / Not Shown; Show changes it to `approved`.
- `approved` = Shown; Hide changes it to `rejected`.
- `rejected` = Hidden; Show changes it to `approved`.
- Same-state requests preserve `updated_at` and create no history.
- The visibility RPC cannot move any review back to `pending`.
- Stale requests fail with `PT409` and are not retried automatically.

## Database impact

Follow-up migration: `supabase/migrations/20260921180000_admin_review_visibility.sql`

- New tables: 0
- New columns: 0
- New indexes: 0
- New RPCs: 1
- Removed RPCs: 1
- Duplicate history systems: 0

## Verification results

- Phase 6 PGlite visibility/security test: PASS
- Review media security contract: PASS
- Hosted RPC definition and grants: PASS
- Hosted public review RLS audit: PASS
- Authenticated `/admin/reviews`: PASS
- Desktop 1440×900: PASS
- Tablet 900×800: PASS; no horizontal document overflow
- Mobile 390×844: PASS; single-column cards and controls, no horizontal document overflow
- ESLint: PASS
- TypeScript: PASS
- Production build: PASS
- `git diff --check`: PASS

The build reports Vite's existing advisory for a JavaScript chunk larger than 500 kB. It does not fail the build.

## Advisor review

Supabase security advisors report the visibility RPC as an authenticated `SECURITY DEFINER` function. This exposure is intentional: browser callers receive execute permission, while the function itself enforces the trusted `auth.uid()` and `private.is_admin()` checks. The private history table's no-policy notice is also intentional because browser roles have no table privileges and no RLS policy.

Existing project-wide notices remain for leaked-password protection and unrelated functions/tables. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Scope boundary

Phase 7, Razorpay, and Delhivery were not started.