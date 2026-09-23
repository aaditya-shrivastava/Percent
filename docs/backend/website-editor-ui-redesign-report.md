# Percent Website Editor UI redesign report

Date: 2026-09-22  
Project: **Percent** (`gijyjdeohvdrnvqfqdha`)  
Status: **WEBSITE EDITOR UI REDESIGN — VERIFIED**

## Old and new layout

The previous page used Homepage/Footer tabs, four permanently expanded banner forms, seven expanded section forms, and a narrow static preview. The redesigned page uses the approved store-designer hierarchy:

- a compact editor toolbar with truthful Saved, Unsaved changes, Saving, and failure states;
- internal Home/Footer navigation;
- one focused content editor at a time;
- a large live preview with browser chrome and device modes;
- a compact page-section manager below the main designer.

The Percent Admin shell and selected Website Editor navigation remain unchanged.

## Editing experience

- The internal navigator exposes only implemented modules: Home and Footer.
- Hero banners appear in a compact selector with thumbnail, visibility state, add, remove, reorder, and selected state.
- Only the selected banner's supported fields are expanded.
- Visibility uses accessible premium toggle controls.
- Desktop and optional mobile media use visual preview cards, dimensions, replacement controls, and a quiet Media details disclosure. Raw paths and Supabase terminology are absent from the primary workflow.
- A missing mobile image displays the desktop fallback without an error.
- Page sections use compact ordered rows with visibility, move, and edit controls. Selecting a section loads its supported presentation fields in the editor.
- Footer mode exposes only the managed tagline and description and renders them in the live preview.

## Live preview

- Draft edits update the preview immediately without saving.
- The preview uses the enabled local banner draft, carousel controls, saved section order, and the catalog-backed product array already hydrated by the storefront.
- Desktop, Tablet, and Mobile controls resize the preview only and never mutate content.
- Preview CTA copy, imagery, section headings, and Footer text follow the current local draft.
- The separate Preview action opens the real storefront in a new tab.

## Responsive verification

Browser checks passed at 1440, 1280, 1024, 834, 768, 600, 426, 425, 390, 375, 360, and 320 CSS pixels. No tested width produced document-level horizontal overflow.

- 1440/1280: navigation, editor, and dominant preview remain in three columns.
- 1024: compact internal navigation keeps editor and preview visible.
- 834/768: editor and navigation remain paired; preview stacks at full available width.
- 600 and below: navigation becomes a top segmented control, followed by editor and preview.
- Narrow mobile rules compact toolbars, fields, section rows, and device controls.

## Regression and security

- Existing `loadWebsiteEditor`, `saveWebsite`, upload, cleanup, validation, signing, and PT409 paths remain in use.
- Navigation and browser-unload protection now warn on dirty or busy editor state.
- Save remains one atomic **Save Changes** action. No draft/publish workflow was fabricated.
- No unsupported page builder, Navbar, branding, colors, typography, social, product-selection, or media-library feature was exposed.
- The managed storefront authority and exact unconfigured bootstrap behavior were unchanged.
- Browser QA produced no console warnings or errors.

## Tests

- `node supabase/test-website-editor-ui.mjs` — pass
- `node supabase/test-website-editor.mjs` — pass
- `node supabase/test-website-media.mjs` — pass
- `node supabase/test-managed-storefront.mjs` — pass
- `node supabase/test-website-image-state.mjs` — pass
- `node supabase/test-website-save-delete-fix.mjs` — pass
- `node supabase/test-website-content-model.mjs` — pass
- TypeScript — pass
- ESLint — pass
- Production build — pass; the existing non-blocking Vite chunk-size advisory remains
- `git diff --check` — pass

## Database impact

- New tables: **0**
- New columns: **0**
- New RPCs: **0**
- New migrations: **0**
- Hosted writes from this redesign: **0**

Final hosted verification still reports **4 banners**, **7 sections**, and the unchanged settings timestamp `2026-09-22 15:38:33.797135+00`. The redesign did not reset or rewrite managed Website Editor content.

Phase 8, Razorpay, and Delhivery were not started or modified.
