# Phase 7B hosted verification checkpoint

Project identity was verified through the Supabase connector: **Percent**, `gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`. No other project was accessed.

Read-only hosted checks completed on 23 September 2026:

- All five new tables exist: `website_pages`, `website_page_sections`, `website_faq_categories`, `website_faq_items`, `website_policy_sections`.
- All five have RLS enabled and zero rows. Direct `SELECT` for `anon` and `authenticated`, and direct write privileges for `authenticated`, are denied.
- All three RPCs exist with the planned signatures. `get_storefront_page(text)` is executable by `anon` and `authenticated`; `get_website_page_editor(text)` and `save_website_page(text,jsonb,timestamptz)` are executable by `authenticated` only.
- The three RPCs are `SECURITY DEFINER` with an empty `search_path`. Hosted definitions of the Admin RPCs contain both `auth.uid()` and `private.is_admin()`. The save definition contains `PT409` and `storage.objects` checks.
- `get_storefront_page('shop')` and `get_storefront_page('faq')` return null, preserving per-page bootstrap fallback before the first managed save.
- A read-only caller-identity check confirmed the editor read RPC rejects an unauthenticated claim and an unassigned UUID with `42501`, while the existing `super_admin` identity can call it and receives null for the as-yet-unmanaged Shop page. This simulates JWT subject values inside SQL; it is not a browser-session test.
- The security advisor lists intentional RLS-without-policy findings for the five RPC-only tables and generic warnings for callable `SECURITY DEFINER` RPCs. These are expected for the explicitly granted public-read and internally authorized Admin functions; their guards still require runtime verification. Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

The first proposed fixture was blocked by automatic approval review before execution: its DO block caught its own deliberate rollback exception and could have committed fake content. That query was discarded. Corrected fixtures used an explicit `BEGIN ... ROLLBACK` transaction, followed by separate zero-row and role checks.

**Runtime matrix passed in rollback transactions:** first save with null expected timestamp; stale save `PT409`; unsupported top-level/section/FAQ category/FAQ item/policy fields `22023`; malformed top-level, FAQ and policy arrays `22023`; missing page and section Storage objects `22023`; an existing `storage.objects` metadata fixture accepted as a page image; FAQ first save and predicated replacement; invalid FAQ replacement preserving the prior document; independent policy tokens; super-admin and admin saves allowed; customer and unauthenticated writes rejected with `42501`. An anonymous user also lacks the SQL EXECUTE grant. The role test changed the existing account to admin and customer **only inside an uncommitted transaction**, then rolled it back. A fresh read confirmed its role is still `super_admin`. A fresh read also confirmed all five content tables and the temporary Storage metadata fixture have zero rows. No production content or role change persisted.

The migration did not create a physical image object; the rollback metadata fixture exercised the database's existence predicate only.

## Edge Function and editor implementation

The existing `percent-website-media` Edge Function was extended and deployed to **Percent only** as active version 4. It accepts canonical `pages/{about|contact}/{64hex}.(jpg|png|webp)` objects; the existing private bucket, byte-level format check, size cap, admin authorization, signed preview, and referenced-object cleanup guard remain in effect. No service-role credential was added to the browser.

Hosted runtime probes confirmed that anonymous `public_page_read` for unsaved About/Contact pages returns an empty media map even when an arbitrary path is requested. Anonymous `admin_page_read`, upload, and cleanup return 401. In an authenticated Admin browser session, a temporary PNG uploaded to a canonical About path, produced a signed draft URL, and could be signed through About draft preview. Requesting that same path through Contact draft preview returned no signed URL. Cleanup succeeded. A fresh hosted query confirmed zero `pages/%` Storage objects, and all five page-content tables still have zero rows. Public signing of a **live referenced** page image necessarily awaits the first real managed page image; no fake live content was inserted for that test.

The local Website Editor now provides Shop, global Product Details, Sold Out, About, Contact, structured FAQ, and independent Shipping/Returns/Privacy/Terms editors. Each page uses its own first-save fallback and `updated_at` concurrency token. The existing same-origin iframe renders actual storefront components with unsaved page drafts; the PDP selector lists real visible products. In browser checks, Shop and policy previews rendered real storefront routes; the About heading changed immediately in its real preview without saving, then was reset; the mobile switch rendered the mobile navigation; the PDP selector listed the two visible hosted products. The About/Contact image controls were enabled only after the hosted Edge upload/preview/cleanup check passed.

The fixed-100-piece claim was removed from source-controlled Sold Out, About, FAQ/policy, PDP, Journal, and search copy where it implied a universal run limit. Existing product-specific `0/100` displays remain correct for designs whose configured limit is 100. The old Journal permalink remains stable while its editorial title and copy now describe per-design limits.

Local verification: TypeScript, ESLint, production build, `git diff --check`, and the Website content/editor/live-preview/managed-storefront/media/backend contract tests passed. The production build reported only its existing large-chunk advisory. No Phase 7B page document was saved and no real content was migrated.
