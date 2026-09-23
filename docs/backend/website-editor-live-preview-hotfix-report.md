# Percent Website Editor Live Preview fidelity hotfix

Date: 2026-09-23  
Project: **Percent** (`gijyjdeohvdrnvqfqdha`, `ap-south-1`)  
Status: **WEBSITE EDITOR LIVE PREVIEW — VERIFIED**

## Root causes

The previous preview was a second, simplified homepage inside `AdminWebsiteEditor.tsx`. It duplicated the Navbar, Hero, two homepage sections, product markup, and Footer with `.preview-*` CSS. It displayed fixture-based `newArrivals`, calculated prices independently, and used raw image URLs. Its fixed 610px stage and nested `overflow:hidden` containers prevented a usable full-page scroll. The Tablet and Mobile buttons changed only the size of this simplified markup, so they could not trigger the storefront's real responsive CSS.

## Implemented architecture

- Added the internal `/admin/website/preview` route. It mounts the production `Header`, `HomePage`, and `Footer` under the same `StorefrontBootstrap` catalog and managed-content loading path as the public site.
- The Website Editor sends its local, unsaved `WebsiteDocument` into the same-origin iframe with `postMessage`. The preview checks the sender origin and parent window, then supplies the draft through `WebsiteContentProvider`.
- The preview route contains no save or upload call. Clicking storefront links inside the preview is contained, so it cannot navigate the Admin page away.
- Removed the duplicated preview Navbar, Hero, product grid, section, and Footer JSX and their custom styles.
- The iframe owns its full vertical page scroll. The surrounding frame has a browser-style header and uses a scaled true viewport width of 1440, 768, or 390 CSS pixels for Desktop, Tablet, or Mobile. Resizing preserves the iframe document and its draft state.
- The preview panel fills most available Admin viewport height and remains sticky on wide screens. On smaller screens it stacks below the editor.

## Shared storefront behavior

The shared HomePage and Hero render enabled, ordered managed sections and banners. This also corrected a public storefront defect: disabled managed sections or banners were previously still rendered after saving. Catalog sections use the existing hydrated product arrays, `ProductCard`, and product-media URLs; the preview has no product fixture or independent INR formatting. Failed image loads are visually hidden by the shared storefront components so they do not display broken-image icons.

The preview renders the real Navbar, Hero crop and typography, carousel controls, section spacing, product cards, design grid, story, and Footer. A browser comparison of the saved public homepage and the preview found the same component sequence, six current product cards, one Header, one Hero, and one Footer. Current product names and INR prices matched, including `Afterimage Tee` at ₹1,499.00 and `Parallel Lines Tee` at ₹1,699.00.

## Draft and scrolling verification

- An unsaved Hero heading edit appeared immediately in the real Hero component and reverted when the field was restored.
- Unsaved section visibility removed Limited Editions from the iframe; restoring visibility brought it back.
- Moving Trending above Best Sellers immediately changed the preview order, then was reverted.
- An unsaved Footer description appeared immediately in the real Footer, then was reverted.
- A preview CTA click left both the Admin URL and iframe URL unchanged.
- In Desktop, Tablet, and Mobile modes, the iframe had a full document scroll height greater than its viewport and could reach the Footer. Wheel scrolling moved the iframe page independently of the Admin page.
- The real image upload/replacement path remains wired to the editor draft and its signed preview URL. No image was uploaded merely for this acceptance check.
- No new browser console warnings or errors were observed.

## Responsive Admin verification

The redesigned Admin page and its preview were checked at 1440, 1280, 1024, 834, 768, 600, 426, 425, 390, 375, 360, and 320 CSS pixels. After layout settled, no tested width had horizontal overflow. The browser reported a 426px minimum for the requested 425px case.

## Regression checks

- `node supabase/test-website-live-preview.mjs` — pass
- `node supabase/test-website-editor-ui.mjs` — pass
- `node supabase/test-website-editor.mjs` — pass
- `node supabase/test-website-media.mjs` — pass
- `node supabase/test-managed-storefront.mjs` — pass
- `node supabase/test-website-image-state.mjs` — pass
- `node supabase/test-website-save-delete-fix.mjs` — pass
- `node supabase/test-website-content-model.mjs` — pass
- TypeScript — pass
- ESLint — pass
- Production build — pass; the existing non-blocking bundle-size advisory remains
- `git diff --check` — pass; Git emitted line-ending notices only

`supabase/test-product-media.mjs` could not run noninteractively because it pauses for a password on stdin. Its affected public behavior was checked in the browser through real, signed catalog cards on both the public homepage and iframe preview. The Website media and managed storefront suites passed.

## Hosted data and scope

The Supabase connector reverified only the active Percent project. The final hosted read still showed **4 banners**, **7 sections**, and the unchanged `website_settings.updated_at` value `2026-09-22 15:38:33.797135+00`.

- New tables: **0**
- New columns: **0**
- New RPCs: **0**
- New migrations: **0**
- Hosted content writes: **0**
- Website media uploads: **0**

Phase 8, Razorpay, and Delhivery were not started.
