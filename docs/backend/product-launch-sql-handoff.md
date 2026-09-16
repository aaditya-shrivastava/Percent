# Percent product-launch image handoff

**BACKEND CHANGE REQUIRED — SQL READY.** The complete SQL to paste into **Percent (`gijyjdeohvdrnvqfqdha`) → SQL Editor** is `supabase/migrations/20260915134912_percent_active_product_media.sql`. It has **not** been executed.

## Exact affected product diagnosis

`/admin/inventory/9d0c1531-7dca-4360-b5b4-6478e5583933` resolves to `[Verification] Product Editor Media`, a hidden draft with production limit 250. Hosted `public.product_variants` has **zero rows** for this exact product ID; `public.product_images` also has zero rows. The editor's authoritative `loadEditor(id)` reads the same product-scoped variants and therefore reloads an empty list. Inventory reads every variant row without enabled, price, SKU, or allocation filters and maps them by `product_id`, so its empty result reflects the database. This is **Case A: no variants persisted for the supplied product**. The current evidence cannot establish whether the variants remained only in unsaved editor state or were saved to another product; no variant attributes exist to compare for this ID.

The UI now says “No variants have been created yet” and links directly to that product's Variants editor section. Disabled variants, when present, remain visible with a reason allocation is unavailable. Editor save continues to reload authoritative data after a successful RPC response; Inventory fetches backend state when its route mounts and on Reload Latest.

## Image correction

The existing private `percent-product-images` bucket remains private. The dedicated migration adds one `storage.objects` SELECT policy limited to `object.sign` and `object.sign_many`, exact objects linked through `public.product_images` to active, visible products. It does not allow listing, drafts, arbitrary objects, or writes. The complete `public.publish_product(uuid,timestamptz)` replacement preserves the existing authorization, lifecycle, category, variant, production, stock, stale-version, and atomic activation checks. Its only changed readiness check accepts a product-scoped `storage://percent-product-images/...` primary image when the corresponding Storage object exists; existing HTTPS primary images remain valid.

The storefront resolves eligible active-product images in batches to one-hour signed HTTPS URLs and refreshes the catalog before those URLs expire. It never passes `storage://` to a product image element. Publication Readiness now distinguishes a missing primary image from saved media that cannot be delivered. A signed URL already issued for an active object can remain usable until its expiry; removing the object is required for immediate revocation. Archived products using private uploaded media will not receive new anonymous signed URLs under this active-only policy.

Structural impact: **new tables 0, columns 0, schemas 0**. Rollback would drop `percent_active_product_image_signing` and restore the previous complete `publish_product` function from `20260915025947_admin_product_publication.sql`; products published while this policy is active should be reviewed before rollback because their private images would stop loading anonymously.

Local TypeScript, ESLint, and production build passed. Hosted SQL, policy behavior, publication, and anonymous image delivery remain unverified pending manual execution. No production was allocated or product published. Phase 4 remains stopped.
