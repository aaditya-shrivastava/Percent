# Percent product launch - Gate 1 verification

Status: **PARTIALLY VERIFIED; POSITIVE ACTIVE/ARCHIVED SIGNING BLOCKED BY HOSTED DATA**.

Target verified through the available Supabase project-list connector: **Percent**, `gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`. No other Supabase project was accessed.

Phase 4 remains stopped. No real product was allocated or published.

## Hosted verification

| Gate 1 check | Result | Evidence |
| --- | --- | --- |
| Corrected `publish_product` image-path validation | Pass | Hosted function definition retains the corrected `storage://` path check and object-existence guard; existing saved paths match the corrected pattern. |
| Saved primary upload satisfies backend image readiness | Pass | Hosted primary image rows match the path pattern and reference existing `storage.objects`; local publication test accepts a valid uploaded primary object. |
| Anonymous signing of visible active images | Not exercisable | Hosted Percent has zero visible active Storage-backed images. The hosted policy permits this case; local policy test passes. |
| Anonymous signing of visible archived images | Not exercisable | Hosted Percent has zero visible archived Storage-backed images. The hosted policy permits this case; local policy test passes. |
| Anonymous draft image access | Pass | Hosted anonymous metadata and signing requests were denied. |
| Anonymous bucket listing | Pass | Hosted anonymous listing was denied or returned no objects. |
| Unrelated image object access | Pass | Hosted anonymous signing of an unrelated product path was denied. |
| Publication Readiness recognizes saved primary upload | Pass | Hosted saved primary rows have valid paths and existing objects; local editor and publication checks pass. |
| Home / Shop / PDP signed-image resolution | Code/local pass; hosted visual check pending | Storefront loader signs visible product-scoped paths and refreshes signed URLs; no live visible hosted image exists to render. |
| Existing publication guards | Pass | Hosted function definition retains admin, version, lifecycle, variant, allocation, inventory, and configured production-limit guards; local publication tests pass. |

The positive hosted signing and storefront render checks remain open. A policy definition or local test alone does not prove successful anonymous signing of a live hosted image.

- `percent_active_product_image_signing` is now corrected. It allows `anon` and `authenticated` `SELECT` only for `object.sign` / `object.sign_many` on `percent-product-images`, and only when the object is referenced by `public.product_images` for a visible product whose status is `active` or `archived`.
- `public.publish_product(uuid,timestamptz)` still uses the existing authenticated admin `SECURITY DEFINER` pattern, fixed `search_path`, optimistic version guard, draft-only lifecycle guard, verification-product denial, category/variant/production/inventory guards, and configured `production_limit` checks.
- Existing hosted private `storage://percent-product-images/products/{productId}/{64hex}.{jpg|png|webp}` rows now satisfy the corrected image-path validation, and their referenced Storage objects exist.
- Anonymous hosted API verification passed for hidden draft denial: draft product rows, draft variant rows, draft image metadata, and draft image signing are unavailable anonymously.
- Anonymous hosted API verification passed for unrelated object denial and bucket listing denial.
- Hosted data currently contains only hidden draft products. There are `0` visible active products and `0` visible archived products with Storage-backed images, so anonymous signing of a real visible active image and a real visible archived image cannot be exercised without temporarily changing hosted catalog state or performing the real acceptance launch.

## Local verification

- `node supabase/test-product-publication.mjs` passed. This includes admin-only publication, stale/direct bypass rejection, complete allocation requirements, configured production limits, missing uploaded object denial, valid uploaded primary image readiness, active/archived signing policy behavior, listing denial, and one-way publication lifecycle.
- `node supabase/test-product-draft-rpc.mjs` passed.
- `node scripts/test-product-editor.mjs` passed.
- `node scripts/test-admin-inventory.mjs` passed.
- `node supabase/test-product-launch-anon.mjs` passed against hosted Percent.
- `node supabase/test-product-launch-gate1.mjs` passed against hosted Percent with `visibleActiveOrArchivedImageCount: 0` and `visibleSigningTested: false`.

## Frontend image resolution

The storefront catalog loader queries visible `active` and `archived` products, signs only product-scoped private Storage image paths, and maps Home / Shop / PDP gallery images to signed HTTPS URLs. The bootstrap refreshes hosted catalog data before signed URLs expire.

Because hosted Percent currently has no visible active or archived products, Home / Shop / PDP signed-image resolution is verified by code path and local tests, but not by a live visible hosted product.

## Security advisors

Supabase security advisors show the expected warnings:

- Four signed-in-callable `SECURITY DEFINER` admin RPC notices: `adjust_variant_inventory`, `allocate_product_run`, `publish_product`, and `update_order_lifecycle`. These are intentional admin RPC surfaces with internal admin checks.
- Leaked password protection is disabled for Auth.

Advisor references:

- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Result

Gate 1 cannot honestly be marked fully passed yet because the hosted project has no visible active or archived Storage-backed product images to test the two positive anonymous signing cases. The backend policy and publication readiness correction are in place and the negative hosted security checks pass.

No hosted writes were made during this verification. No real product was allocated or published, and Phase 4 was not started. The gate is **not yet ready to be certified as fully passed**.

The remaining checks require a deliberately chosen visible hosted product with a saved primary image. At the authorized real product acceptance test, verify active signed image delivery on Home, Shop, and PDP using the launched product. Verify archived signing when a real visible archived/sold-out product exists.
