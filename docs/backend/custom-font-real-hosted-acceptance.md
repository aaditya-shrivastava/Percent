# Real hosted Custom Font Library acceptance

Status: **Super Admin and Anonymous PASS. Customer pending; user will supply that real session later. Ordinary Admin DEFERRED — no real Admin account exists.**

The storefront ran locally against the real hosted Percent Supabase project. Authentication used the supplied real Firebase Super Admin session and Percent's normal authenticated client. No accounts were created, tokens extracted, SQL executed, migrations created, history repaired, or authorization architecture changed.

| Check | Real hosted result |
|---|---|
| Super Admin editor | Typography, library, four roles, all 12 built-ins and Save Changes load successfully |
| Legal upload | Lora SIL OFL project-local WOFF2 uploaded as 400 and 700 Normal; family “Percent Hosted Font Test” saved with two faces |
| WOFF2 validation | Hosted Edge accepted both actual files; delivered and previewed bytes remain WOFF2; public delivery matches the original legal local file exactly |
| Preview | Actual authenticated binary previews return 200 and `private, no-store`; SDK produces Blob; controlled blob font rules load both faces |
| Browser privacy | Actual browser font catalog and error responses contain no Storage paths, hashes, private MIME/size fields, cleanup paths, or credentials; service-only catalog and resolver RPCs deny the real Super Admin browser with 42501 |
| Heading only | Published through normal editor; Home, Shop, Product Details, About, Blog and Contact use custom Heading where assigned; Display/Body/UI remain Inter |
| Persistence | Editor reload, storefront refresh and direct navigation preserve hosted configuration |
| Public delivery | Two opaque UUID URLs return exact legal bytes with `font/woff2`, CORS `*`, `public, max-age=31536000, immutable`, opaque ETags, correct HEAD lengths and conditional 304s; no signed Storage URL or privileged credentials |
| Apply Everywhere | Before saving, refreshed live storefront remains Heading-only. After saving, all four role variables and rendered Home display/heading/body/UI samples use the custom family |
| Admin isolation | Admin heading remains `Inter, ui-sans-serif, system-ui, sans-serif` during all-role storefront publication |
| Active guards | UI safeguards verified; actual hosted delete, disable and destructive face-removal requests return controlled 409 errors; family stays active with both faces intact |
| Restoration | All four roles Inter, heading 700, body 400, spacing 0; saved normally and verified on refreshed storefront |
| Delete/cleanup | Temporary family removed; real authenticated editor catalog reports all families 0 and all faces 0. A fresh authenticated `font_cleanup` enumeration for the test UUID reports removed 0, confirming no canonical test Storage bytes remain |
| Built-ins | All 12 preview options clicked and their actual renderings visually sampled in the real Super Admin editor; none published |
| Anonymous | After real logout, Shop renders with the active original Inter asset. Anonymous upload/catalog/preview and service-only RPCs are denied. Public custom WOFF2 delivery was also verified without credentials while the test family was active |
| Content integrity | Anonymous `get_storefront_content()` exactly matches the pre-test snapshot, excluding only the monotonic top-level update timestamp; typography, banners, sections and all other settings are unchanged |
| Customer | **NOT EXECUTED — user will supply the real Customer session later** |
| Ordinary Admin | **DEFERRED — no real Admin account exists**; no hosted Admin result is claimed |

Temporary family UUID: `e1df4f06-28c2-4455-a518-a0d99187f485` (now deleted). Remaining temporary family / face / canonical Storage-object counts: **0 / 0 / 0**. Storage verification used the existing authenticated Edge cleanup enumeration; no SQL or privileged browser metadata was used.

## Genuine defects fixed

1. Supabase FunctionsClient parses `font/woff2` as text. The authenticated preview response now uses `application/octet-stream`, which the SDK correctly decodes into Blob. Preview remains authenticated and no-store; public GET font delivery retains `font/woff2`. Deployed as Edge version **15**. Regression coverage exercises the actual Supabase FunctionsClient, not a transport mock that assumes every font response is a Blob.
2. The library preview's Close button inherited dark text against its dark background. One About-independent Admin font-library CSS rule restores readable light text. Verified in the actual preview.

No feature redesign or unrelated implementation changes were made. The local `scripts/font-hosted-acceptance.html` page is an acceptance harness, excluded from the production app build; it uses the existing authoritative session/client and narrowly targets the disposable test family.

## Validation

- TypeScript: PASS
- ESLint: PASS
- Production build: PASS (temporary output directory; tracked dist preserved)
- git diff --check and new-source whitespace checks: PASS
- Actual Edge handler and actual Supabase SDK binary-preview regression: PASS
- Affected UI acceptance: PASS
- Hosted public delivery/HEAD/304/CORS/cache: PASS
- Hosted public anonymous denial and exact restored-content comparison: PASS

A transient DNS failure occurred after restoration and cleanup. Connectivity recovered on the single retry; anonymous browser and endpoint checks then passed. It is not an outstanding blocker.

## Remaining work

Only real Customer acceptance remains: confirm the role, test direct upload/manage/save/delete/Admin-preview and service-only catalog/resolver denial, and verify normal public browsing and active built-in font delivery. The user chose to supply that session later. The complete acceptance phrase is intentionally withheld until this passes.

Evidence: [session results](custom-font-real-hosted-session.json), [public font delivery](custom-font-real-hosted-delivery.json), [anonymous and restored-content results](custom-font-hosted-public-results.json), and [cleanup screenshot](custom-font-real-hosted-cleanup.jpg).
