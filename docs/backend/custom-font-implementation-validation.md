# Custom Font Library implementation and validation

## Implemented

- Typography has 12 real built-in families with licensed project-local WOFF2 assets (Georgia and system-ui use installed system fonts).
- Custom Font Library supports friendly family names, multiple 100–900 normal/italic faces, required webfont permission confirmation, actual file previews, management, enable/disable, and protected deletion.
- Display, Heading, Body, and UI selectors and Apply Everywhere retain the existing draft / Save Changes publication workflow and PT409 conflicts.
- Storefront font rules use controlled UUID aliases and `font-display: swap`. Only selected families are registered, and browsers request the faces actually rendered. Admin controls retain their own typography; previews load authorized temporary blobs.
- Edge version **14** implements signature/directory/bounded Brotli/Fontkit decoder validation, MIME/extension/2 MiB checks, SHA-256 and canonical Storage paths. It uses service-only catalog/resolver wrappers internally. Browser font responses contain no Storage paths, hashes, MIME metadata, byte-size metadata, or cleanup paths.
- Stable public delivery accepts only one opaque `asset_id`, resolves current live usage before delivery, verifies stored bytes, and supplies CORS, immutable caching, opaque ETags, HEAD and conditional requests. Preview responses are authenticated and `no-store`.
- Deletion and rollback clean up unreferenced bytes. Font objects never appear in image Media Library cards. Existing image upload, media and authorization flows are preserved.

## Hosted verification

The manually executed privacy migration's definitions and ACLs were inspected. Browser roles cannot execute either private catalog helper or the public service-management/delivery wrappers. Service-role execution succeeds. Admin and public catalog payloads are minimized; family IDs/names/status/timestamps/usage and face IDs/weights/styles remain available as appropriate. Deletion returns no cleanup paths. All 12 built-ins remain accepted. The media bucket remains private with JPEG/PNG/WebP and WOFF2 MIME support. Typography and existing Website Editor content match the pre-implementation snapshot. No SQL was executed to modify hosted schema, settings, grants, data or migration history during this implementation.

Hosted read-only HTTP tests verify malformed ID 400, unknown ID 404, arbitrary path parameter 400, anonymous upload/management/preview denial, anonymous service-only RPC denial, minimal storefront payload, and CORS. Final hosted inspection finds **zero font families, zero faces, zero font Storage objects**, and unchanged original Inter typography.

## Checks passed

- `npx tsc -b`
- `npm run lint`
- `npm run build -- --outDir <temporary build directory>`
- `git diff --check` and whitespace checks for new source/docs
- Deno type-check of the actual Edge entrypoint
- `node scripts/test-woff2-validation.mjs`: actual bounded production decoder accepts all 87 bundled faces; malformed/signature/length/MIME/extension/size/weight/style/SHA/path cases checked
- `node scripts/test-builtin-font-assets.mjs`: 87 browser-decoded assets, 12 distinct renderings, licensing/local loading and no global style changes
- `node scripts/test-website-font-edge.mjs`: actual Edge handler, simulated Supabase boundary; Admin/Super Admin uploads, anonymous/customer denial, malformed/oversize/license/duplicate rejection, safe metadata, delivery/CORS/cache, active protections, PT409 and complete cleanup
- `node scripts/test-website-font-ui.mjs`: actual production editor/backend/runtime and actual Edge handler, simulated SQL/Storage transport; licensed multiple-face upload, preview, enable/disable, manage/rename, Heading-only publication, unchanged Body/UI, draft/save, refresh/direct navigation, delivery, Apply Everywhere, Admin isolation, active safeguards, restoration and deletion with no fixtures
- SQL/security preflight: all four migrations executed **locally** in PGlite, 22 groups pass, including browser/service grants, RLS, anonymous/customer denial, Admin/Super Admin, metadata minimization, ownership-independent font administration, PT409 and active-family protection
- Responsive editor and upload dialog: 1440, 1280, 1024, 834, 768, 600, 426, 425, 390, 375, 360, 320; no horizontal overflow or JavaScript/console errors in the component test

## Still required before full completion

Authenticated **hosted** Admin and Super Admin acceptance requires sessions supplied by the user. The in-app tab is at Sign In. The reversible upload/apply/refresh/delivery/restore/delete lifecycle has passed against simulated Supabase SQL/Storage boundaries, but has **not** been performed against hosted Supabase. Hosted customer-token upload denial has likewise not been exercised with a real customer session; local handler/SQL tests and hosted grants provide separate evidence.

The storefront frontend is implemented locally and production-build verified; the Edge function is deployed. No storefront hosting deployment was requested or performed. No additional SQL gate is needed based on completed checks. This report does not claim the requested full completion while authenticated hosted acceptance remains pending.

Evidence: `custom-font-privacy-hosted-verification.json`, `custom-font-hosted-public-results.json`, `custom-font-ui-results.json`, `custom-font-sql-preflight-results.json`, `builtin-font-asset-results.json`, and desktop/mobile editor/upload screenshots in this directory.
