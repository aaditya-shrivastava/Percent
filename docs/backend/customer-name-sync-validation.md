# Customer full-name profile sync

## Root cause

The Firebase provisioner inserts public.profiles(id) without name fields, so display_name receives the existing database default Percent Customer and first_name/last_name remain null. ProfileContent splits display_name when those fields are null, producing the displayed Percent / Customer. The email/password signup flow then attempted to update profile names through the resolved session. refreshPercentSession can return before Firebase claim hydration finishes, and AuthPage previously redirected once authenticated even while signup was still saving the name. Google provisioning did not initialize the generic profile from Firebase displayName.

## Narrow change

- Parse full names with whitespace normalization, preserving casing: first token is first_name, remaining tokens are last_name; single-word names use an empty last_name.
- Complete explicit signup-name persistence using the existing authenticated provisioner and profiles fields before redirect.
- Wait for claim hydration by subscription, without arbitrary timeouts; refresh the authoritative profile afterward.
- Initialize only Customer profiles with empty name parts and an empty/generic display name. Compare all original stored name fields in the UPDATE filters so a concurrent user edit wins. Read the authoritative result afterward.
- Existing valid names and later edits remain authoritative. No continual Firebase overwrite, email-derived name, staff initialization, new table, migration, or SQL.
- Keep failed signup-name persistence on registration instead of silently redirecting. Preserve one-word names in Edit Profile by removing the last-name-required constraint. No Profile design changes.

## Validation

PASS scripts/test-customer-name-sync.mjs: all requested parsing/persistence cases, claim-hydration barrier, Google initialization, existing and edited name preservation, no usable name fallback, concurrent edits, controlled write failure, staff isolation, phone preservation.

PASS scripts/test-customer-name-rendering.mjs: actual Profile form and AccountShell server rendering, first/last/sidebar, one-word and multipart names, edited name, existing email/phone values.

PASS TypeScript (standalone tsc -b and final production build), ESLint, production build to a temporary directory, git diff --check.

## Hosted evidence

The real Customer Firebase displayName is Aaditya Shrivastava. The existing Customer is safely recovered through the normal session flow and the authoritative profiles row contains first_name Aaditya, last_name Shrivastava, display_name Aaditya Shrivastava. Profile and sidebar agree.

A reversible normal Edit Profile test changed the last name to Name Check. Profile/sidebar, hard refresh and authoritative database reads retained Aaditya Name Check despite Firebase still holding Aaditya Shrivastava. The original name was restored through normal Edit Profile and verified in the database and UI. No new account/fixture was created; no phone/email modifications were made.

Direct Profile navigation and refresh pass. Final real logout/login acceptance passes: signed-out /profile redirects to Sign In, the Customer completed normal sign-in, and Profile retains Aaditya / Shrivastava after refresh and direct navigation. Normal identity provisioning resolves the same internal UUID repeatedly and the authenticated exact-count profile query returns one existing profile, created 2026-10-02, with the correct name. No generic fallback was recreated. Evidence is customer-name-final-login-results.json and customer-name-final-login-profile.jpg. No application code changed during this final acceptance; the temporary read-only verification page was removed. Fresh signup and Google initialization are covered by isolated boundary tests; new hosted accounts were not created.

Evidence: customer-name-hosted-results.json, customer-name-profile-restored.jpg.

## Files in this change

src/backend/customerName.ts
src/backend/percentSession.ts
src/pages/AuthPages.tsx
src/pages/AccountPages.tsx (one-word edit validation only)
scripts/test-customer-name-sync.mjs
scripts/test-customer-name-rendering.mjs
scripts/customer-name-hosted-verification.html
This report and hosted evidence files.
