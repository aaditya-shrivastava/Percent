# Percent Admin Phase 3C — publication audit

Audit date: 15 September 2026.

Target verified through the available Supabase project listing and project detail capability: **Percent**, `gijyjdeohvdrnvqfqdha`, ap-south-1, ACTIVE_HEALTHY. The unrelated project was not accessed.

## Existing lifecycle and storefront contract

`public.products` uses `status` (`draft`, `active`, `archived`), `is_visible`, `is_shop_available`, `production_limit`, `launch_at`, `sold_out_at` and `archived_at`. Public RLS exposes a product and its variant/image children only when `is_visible` is true and status is `active` or `archived`.

The storefront additionally selects `is_visible = true` and status in `active, archived`. Shop results require the mapped active product to have `is_shop_available = true`; availability comes from enabled variants with unsold, unwithdrawn physical units. PDP resolves only products returned by the same public catalog loader, except the explicit archive path.

The physical run is authoritative. `inventory_units` counts every produced piece, including sold and withdrawn units. The existing allocation RPC accepts increases only while draft. The adjustment RPC likewise permits new pieces only while draft, although eligible unsold units may be withdrawn from an active run. Sold-out archival remains tied to `sold_quantity >= production_limit`.

## Hosted state

At audit time all 31 products were drafts and none were public by lifecycle/RLS. The set includes 27 real catalog products and four verification/non-public drafts. The 27 real products have no physical units. Existing verification drafts remain incomplete or otherwise ineligible.

The 27 seeded catalog designs have direct HTTPS primary image URLs. They can be rendered by public clients after an intentional future publication. The private `percent-product-images` bucket remains non-public. Admin uploads are stored as `storage://percent-product-images/...`; the existing media Edge Function issues five-minute signed URLs only after an admin role check. The public catalog has no customer-facing signing path. Consequently, the publication operation must reject a private `storage://` primary image so it cannot activate a design whose image customers cannot load. No bucket policy is weakened.

## Blocker

There is no publication RPC or other trusted atomic activation operation. Although the existing admin policy permits product management, a direct status update would not enforce full allocation, sellable inventory, image delivery, sold-history consistency or stale-write protection. Frontend validation alone cannot establish the lifecycle invariant.

A narrow database operation is therefore required before Phase 3C UI work. The migration also adds a private trigger guard so a direct authenticated table update cannot bypass the new RPC for `draft → active`, and permanently blocks `active/archived → draft`.

No table, column, schema, enum, view or audit table is required.

