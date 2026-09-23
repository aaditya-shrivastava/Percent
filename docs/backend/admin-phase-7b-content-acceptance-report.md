# Phase 7B real-content acceptance report

**Status:** PHASE 7B — MULTI-PAGE WEBSITE EDITOR VERIFIED  
**Project:** Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`)  
**Date:** 23 September 2026

The Supabase connector confirmed the project identity before hosted writes. The unrelated `spacetees` project was not accessed. No schema migration was added or deployed during this acceptance.

## Accepted managed pages

Saved the existing source-controlled storefront presentation through the authenticated Website Editor, in the requested order: Shop; Product Details; Sold Out; FAQ; Shipping, Returns, Privacy and Terms policies separately; About; Contact. Each page now has a real `website_pages` document and `get_storefront_page(page_key)` returns managed content. First-save bootstrap content is retired independently for all ten pages. The public loader distinguishes an absent document from an RPC failure, so ordinary runtime failures do not silently restore source-controlled copy. The editor's first-save control was corrected to allow saving an unchanged bootstrap draft without inventing a content edit.

Hosted final counts: **10** page documents, **20** page sections, **6** FAQ categories, **9** FAQ items, **48** policy sections, and **4** `pages/%` Storage objects. All four objects are referenced by live About or Contact content; **0** orphaned and **0** missing objects. No product, inventory, order, customer, review, payment, shipping, Home, Footer, or Blog data was changed by this acceptance.

## Storefront and editor checks

- Shop displays the saved heading and copy while its grid, categories, tags, filters, sorting, prices, images, and availability continue to use the real catalog. The narrow Shop hero overflow found at 390–320 px was corrected in CSS and rechecked.
- Product Details preview used a real visible product. The managed fields are presentation labels and copy; gallery, variants, price, production count, reviews, related products, and cart behavior remain product-owned. The preview selector changes only the preview product.
- Sold Out displays managed archive copy and retains its real archived-product source. No archive, sold count, or inventory mutation was made. The current archive has no products to display.
- FAQ has the existing six categories and nine questions/answers in managed rows. Public category/accordion behavior and code-owned links remain. No universal 100-piece claim was carried forward.
- Each policy has its own managed document and concurrency token. Public article routes retain their table of contents, previous/next links, and Contact CTA. Existing legal text was preserved.
- About has three managed editorial images; Contact has one. Their public pages render the saved copy and live image URLs. Contact's inquiry fields, topics, consent control, and support links remain code-owned. No inquiry was submitted as part of the test.
- Contact was reloaded in the Admin editor after save: the status was **Saved**, the managed image and sections persisted, and the live iframe matched the public page. Other pages were individually checked during their save/preview/public transition. The preview iframe renders the real storefront components.

## Media and security

The four uploaded images came from the existing storefront source imagery and were uploaded through the Admin-only `percent-website-media` path. Their canonical paths are three `pages/about/<64hex>.jpg` objects and one `pages/contact/<64hex>.jpg` object, with saved dimensions and signed Admin previews. Public images load from signed URLs. Anonymous `public_page_read` returned exactly three About paths, one Contact path, and no Shop paths; it ignored an arbitrary unreferenced path and did not cross-sign the Contact path for About. The bucket remains private and direct table access is denied.

Hosted anonymous API probes: `get_storefront_page('shop')` returned 200 with managed content; editor read, editor save, media cleanup, and direct `website_pages` read returned 401. The earlier hosted Phase 7B rollback matrix verified customer/anonymous save denial and admin/super-admin authorization; no customer account was created for this acceptance. Role checks and media upload/cleanup authorization remain in the Edge Function. No browser service-role credential was introduced.

For concurrency, a rollback-only transaction loaded the real managed Shop version as Editor A, saved a temporary heading, attempted Editor B's save with the original token, and observed `PT409`. The first save remained intact inside the transaction and rollback restored the original heading and timestamp. A separate two-tab Admin UI check then loaded the same Shop version in both editors, saved a temporary heading in A, and confirmed B's stale save was rejected without overwriting A. The UI's PostgREST error extraction was corrected so B displays **“This page changed elsewhere. Reload the latest version before saving again.”** A immediately restored the original **Shop Exclusive** heading and copy. A hosted read confirmed the original copy is live; its `updated_at` advanced as expected from the two real saves. The stale B draft was not auto-retried or saved.

## Responsive and quality checks

The real public About and Shop pages were measured at 1440, 1280, 1024, 834, 768, 600, 426, 425, 390, 375, 360, and 320 px. After the Shop fix, document width equaled viewport width at every requested size. The Admin Website Editor was also measured at all requested sizes after layout settled, with no document overflow. At 320 px, Shop, FAQ, four policy routes, Contact, Sold Out, and About loaded their managed headings and fit horizontally. Desktop/tablet/mobile preview controls use the same-origin production storefront iframe; the existing live-preview test covers viewport scaling and independent full-page scrolling. A current public browser tab reported no console errors. An older long-lived Admin tab retained historical transient Supabase `Failed to fetch` entries; the present saved/reloaded editor and public routes loaded successfully.

Passed: 8 Website Editor/content/live-preview/managed-storefront/media contract test files; TypeScript through `npm run build`; ESLint; production build; `git diff --check`. Vite reported only its non-failing large-chunk advisory. The hosted Phase 7B runtime/security matrix was previously completed in rollback transactions, including FAQ atomic replacement, independent policy tokens, validation, role denial, and `PT409`.

**Hosted-data impact:** ten real managed page documents, their structured child rows, and four referenced private-media objects. **Structural database changes in this acceptance:** none. No Phase 8, Razorpay, or Delhivery work was started.
