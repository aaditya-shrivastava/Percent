# Percent Admin Phase 7 — Website Editor completion report

Date: 2026-09-22  
Hosted project: **Percent** (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
Status: **PHASE 7 — WEBSITE EDITOR VERIFIED**

## Hosted saved content

- The target was reverified as the active, healthy Percent project before hosted reads. `spacetees` was never accessed.
- The corrected `save_website_content(...)` function was verified and the preserved authenticated draft saved successfully.
- Saved rows: **4 banners**, **7 sections**, and the existing `website_settings` row updated at `2026-09-22 15:38:33.797135+00`.
- Enabled section order: Limited Editions, Best Sellers, Trending, New Arrivals, Oversized Fit, Shop by Design, Brand Story.
- Footer values persisted as `Less Ordinary. More You.` and `Limited pieces, made to be remembered.`
- The four saved banner records retain the original canonical JPEG paths and dimensions. All four optional mobile paths are null, so mobile correctly uses the desktop image fallback.

## Managed-content authority and bootstrap retirement

- `get_website_editor()` returns the saved managed document and refreshed signed admin previews.
- `get_storefront_content()` returns the enabled managed banners and sections.
- Once managed content exists, Supabase is the authoritative Home/Footer source. Ordinary RPC or signing failures reach the deliberate unavailable/error state and do not silently restore hardcoded marketing content.
- Bootstrap content remains only for the exact unconfigured state. The saved editor reload has no bootstrap notice, bootstrap labels, or unsaved-bootstrap state.
- Public RPC section keys are normalized into the editor/storefront model, preventing managed sections from falling through to the wrong component.

## Media and security verification

- The `percent-website-media` bucket remains private.
- Public signing returned only the four enabled, live referenced banner paths. An injected arbitrary path was denied.
- Anonymous bucket listing exposed no objects.
- Anonymous admin-read and cleanup calls returned `401`.
- Admin signed previews work after save and reload; the save path now reloads the authoritative document to hydrate fresh preview URLs.
- Customer media management remains denied by the role contract; browser clients receive no service-role credential or direct Storage mutation capability.
- The four canonical JPEG objects referenced by the saved document remain intact and unchanged.
- The final storage audit found **8 total bucket objects**: the four live referenced JPEGs plus four unreferenced PNG objects. The unreferenced objects are not returned by public signing and were left untouched; no destructive cleanup was performed during acceptance.

## Storefront and editor verification

- The public homepage rendered all four managed hero banners from signed private-media URLs.
- Hero rotation advanced correctly; the CTA routed to `/shop`.
- The seven managed sections rendered in saved order with saved headings/copy, while catalog sections continued to use hosted product data.
- Footer values came from the managed settings row.
- Responsive hero markup uses an optional mobile source and the saved desktop image as the correct fallback when `mobile_image_path` is null.
- Editor reload preserved banner paths, dimensions, ordering, sections, footer values, and signed previews. It showed no desktop-upload validation errors.
- No new browser console errors were produced after the corrected managed-content reload.

## Validation

- `node supabase/test-managed-storefront.mjs` — pass
- `node supabase/test-website-image-state.mjs` — pass
- `node supabase/test-website-save-delete-fix.mjs` — pass
- `node supabase/test-website-editor.mjs` — pass
- `node supabase/test-website-media.mjs` — pass
- `node supabase/test-website-content-model.mjs` — pass
- ESLint — pass
- TypeScript (`tsc --noEmit --incremental false`) — pass
- Production build — pass; only the existing non-blocking Vite chunk-size warning remains
- `git diff --check` — pass; Git emitted only line-ending notices

The focused suites cover the managed save/reload model, Website Editor RPC contract, PT409 stale-write behavior, managed storefront authority, homepage and Footer integration, image state, private-media signing, role restrictions, and arbitrary-path denial.

## Hosted-data impact

- Database structure changes in this acceptance continuation: **none**.
- Saved content: **4 real banner rows**, **7 real section rows**, and the existing settings row updated.
- Referenced media: the same four canonical objects already present in the preserved draft; no banner was re-uploaded for the successful save.
- Edge Function: `percent-website-media` version 3 remains active.
- No product, order, payment, shipping, checkout, or inventory data was changed.

Phase 8, Razorpay, and Delhivery were not started.
