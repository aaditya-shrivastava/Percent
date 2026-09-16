# Percent Admin Phase 2B — editor implementation and verification report

Superseded by [admin-phase-2b-completion-report.md](admin-phase-2b-completion-report.md): the approved conflict correction and final acceptance checks passed. Phase 2B is complete. The content below preserves the earlier checkpoint.

14 September 2026, Asia/Calcutta. Supersedes the earlier task checkpoint report.

**Status: editor implemented; acceptance incomplete due to a newly discovered hosted stale-conflict defect.** Stopped as explicitly required when a new backend blocker appears. Phase 3 has not begun.

## Role verification

The connector verified Percent gijyjdeohvdrnvqfqdha, ap-south-1, ACTIVE_HEALTHY and uniquely resolved the existing permanent Auth user. No unrelated project was accessed.

After direct chat authorization, these exact transitions completed, one at a time:

1. super_admin → admin → super_admin. JPG, PNG and WebP upload, signed delivery and deletion passed. Arbitrary storage access was denied. Restoration was confirmed through get_my_role before proceeding.
2. super_admin → customer → super_admin. Upload, delete, cleanup and admin-only read all returned 403. Restoration was immediately confirmed through get_my_role.

Fresh authenticated HTTP sessions were used. No browser testing occurred while customer. No Auth users or profiles were created. No credentials were saved in source, documentation or test configuration.

**Final independent backend check: get_my_role() = super_admin; exactly one Auth user and one correctly linked permanent profile.** Evidence: phase-2b-media-role-admin.json, phase-2b-media-role-customer.json and phase-2b-media-tests-super_admin.json.

## Database and server changes

| Structure | Added |
| --- | ---: |
| Tables | 0 |
| Columns | 0 |
| Schemas | 0 |

The earlier approved migration 20260913161109_admin_product_draft_save.sql adds one SECURITY INVOKER RPC. It derives identity from auth.uid, checks existing admin roles, uses a fixed empty search_path, preserves RLS/audits/lifecycle constraints, and atomically coordinates products, tags, variants, images and variant-image relations. New products remain invisible, unavailable drafts. No inventory writes, publishing, product deletion or restore were added.

The single percent-product-media function remains deployed at version 2. It explicitly verifies Auth and get_my_role on every request; gateway JWT verification is disabled because custom authentication is implemented in the body. Service credentials stay server-side. The existing bucket is private, with product-scoped generated paths, supported MIME/signature checks, 10 MB limit, five-minute signed delivery, fully paginated metadata reads and idempotent retry identity.

Upload association failure triggers immediate object cleanup; the hosted test confirmed cleanup. Cleanup failure reports a recoverable orphan path. Deletion removes Storage first, then metadata, retaining a retryable relation on database failure. Infrastructure cleanup failure was reviewed but not deliberately induced.

No additional database logic was deployed during the editor implementation. The proposed error-code correction below has not been applied.

## Product Editor implementation

Both /admin/products/new and /admin/products/:id/edit now use the real editor within the existing Admin shell and approved charcoal visual system.

- **Overview:** name, new slug/design code, short/full descriptions, INR price/comparison price, existing category, actual fit values, existing tags, material/style/care/shipping text. Existing slug/design code remain read-only. New slug follows the name until customized. No category/tag CRUD.
- **Variants:** actual colors and sizes, SKU suggestion following uppercase identity/color/size convention, prices and enabled state. Duplicate combinations/SKUs are validated. Unsaved variants can be removed; persisted variants retained/disabled; allocated/history identity locked. No stock controls.
- **Images:** authenticated upload, private signed display, primary selection, ordering, alt description, removal confirmation and retry/orphan feedback. Draft and pending edits must be saved before Storage mutation. Signed URLs refresh periodically and manually.
- **Production:** positive per-design limit, default 100 only, locked after allocation. Allocated/sold/remaining/available counts are read-only. Manage Inventory links to the Phase 3 placeholder.
- **Preview:** image, name, price, fit, status and limit. Drafts have no public-view link. Archived, non-draft and completed designs are read-only. No Restore, publish, delete product or restock.
- **Save behavior:** transactional RPC, duplicate submission disabled, new-draft navigation, success/error feedback and retained invalid form data. Stale-conflict UI is implemented but its hosted HTTP acceptance is blocked by the error code.
- **Dirty state:** data-router support enables route/Back blocking, Stay/Discard dialog and beforeunload. Same-account session refresh no longer clears unsaved editor state; identity changes still clear session state.
- **Thumbnails:** Products list resolves private images through authorized signed delivery.

## Files

Added: src/backend/admin/editor-model.ts; src/backend/admin/editor.ts; src/pages/admin/AdminProductEditor.tsx; src/pages/admin/editor.css; scripts/test-product-editor.mjs; supabase/test-media-role-boundary.mjs; role test reports and conflict proposal.

Changed: src/pages/admin/AdminRoutes.tsx; src/backend/admin/products.ts; src/main.tsx; src/hooks/usePercentSession.ts. Earlier approved RPC/media files and fixtures remain part of Phase 2B. Unrelated pre-existing working-tree changes were preserved. No commit or frontend hosting deployment was performed.

## Hosted and browser acceptance

| Check | Result |
| --- | --- |
| Permanent login, /admin and /admin/products | Passed |
| New and existing editor load | Passed |
| Browser draft creation | Passed: 129900 paise, limit 250, two variants |
| Name/description/price/tag edits | Passed |
| Production limits 0, -1 and 12.5 | Rejected inline in browser |
| Positive 250/1000 limits | RPC/model tests passed; browser used 250 |
| Duplicate variant and SKU | Rejected in browser and backend tests |
| Immutable identity | Read-only controls; RPC rejection tested |
| Allocated limit and archived mutation | Local/hosted transaction tests passed |
| Customer media boundary | All four operations denied over HTTP |
| Admin/super_admin media | Supported formats, delivery and deletion passed |
| Browser image upload/display | Two private images uploaded and rendered |
| Primary and ordering | Saved; editor preview reflects primary |
| Failed association cleanup | Hosted test passed |
| Stale HTTP save | BLOCKED: custom 40001 triggers retry loop |
| Newer value during stale save | Preserved; stale value never written |
| Unsaved Cancel/Stay and focus trap | Passed |
| Final Back/discard, image removal/recovery UI, thumbnail | Pending final acceptance |
| Public invisibility | Both verification rows are draft, visible=false, shop_available=false; final public API/browser check pending |

## Responsive and accessibility

Actual browser checks covered all four sections at **1440, 1280, 1024, 834, 768, 600, 425, 390, 375, 360 and 320px**: 44 section/width checks, zero horizontal page overflow, zero unlabeled tested form controls. Desktop has two columns; tablet/mobile collapses to one editor column. Mobile navigation scrolls horizontally. Desktop image layout and 320px Overview were visually inspected. Viewport overrides were reset.

Keyboard Shift+Tab/Tab wrapped correctly between Stay and Discard in the modal. Field labels, associated production errors, visible focus and reachable section/variant/image controls were verified. All recovery/navigation combinations are not yet fully accepted.

## Automated verification

Product Editor model tests, existing admin foundation/role/product tests, complete-migration PGlite RPC tests, role-specific hosted media tests, TypeScript, ESLint, production build and git diff --check passed. Source/docs/scripts scanning found no supplied password or service secret. Direct SQL transaction tests previously passed but do not exercise PostgREST's HTTP retry layer.

The build retains its large-client-chunk warning. Supabase advisors retain the existing [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) warning. No unrelated configuration was changed.

## Verification data retained

The original 27 real products were not edited by these tests. Two authorized invisible drafts remain; deletion protections were not weakened:

| Draft | ID | Final state |
| --- | --- | --- |
| [Verification] Product Editor Media | 9d0c1531-7dca-4360-b5b4-6478e5583933 | Limit 250; 129900 paise; no variants/images |
| [Verification] Product Editor UI — Edited | f6b65a97-1f13-4b77-b760-7a944620f5e7 | Limit 250; 139900 paise after edit; Charcoal S/M variants; two private pixel test images |

Both remain draft, hidden and unavailable to shop. No Black color exists in the database, so real Charcoal was used. Images are generated test fixtures. Browser/media tests allocated no inventory.

## New blocker and proposed correction

The RPC raises SQLSTATE 40001 for stale updated_at. Supabase documents that affected PostgREST versions retry this code indefinitely. Browser testing reproduced Saving remaining pending while the newer database value remained intact. Test tabs were closed and a final backend check found zero active save_product_draft requests; no unrelated connections were terminated.

The exact proposal is in [phase-2b-conflict-correction.md](phase-2b-conflict-correction.md): change only the existing stale exception to PT409, update client/test recognition and verify HTTP/browser recovery. No additional RPC or structure is needed. This correction is not applied because the instructions require stopping on a newly discovered backend blocker.

Phase 2B is not fully verified until that correction and remaining acceptance checks pass. The permanent account finishes as **super_admin**. Phase 3 remains deferred.
