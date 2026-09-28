# Phase 8 Blog implementation — hosted acceptance report

**Status: hosted acceptance remains open only on the customer-session denial check.** The Phase 8 implementation, disposable publication lifecycle, managed-media lifecycle, malformed-document validation, featured conflict, cleanup, lint, TypeScript and production build passed. The final authorization decision explicitly defers managed public-route rendering until real-content cutover and accepts structural coverage for the ordinary `admin` role when no dedicated Admin session exists.

## Verified target and final hosted state

The Supabase connector identified `gijyjdeohvdrnvqfqdha` as **Percent**, `ap-south-1`, `ACTIVE_HEALTHY`. No other project was accessed.

After cleanup, hosted Percent is back to exactly:

- posts: **9**
- drafts: **9**
- published: **0**
- sections: **27**
- image rows: **12**
- `percent-blog-images` objects: **0**
- first-publication markers: **0**
- disposable `phase-8-*` slugs: **0**

No real article row, child row, media object, publication state, slug, copy, feature flag or publication marker was intentionally changed. Both disposable articles were removed by exact UUID and slug after their media was first unreferenced and cleaned through `percent-blog-media`.

## Hosted 26-case matrix

| # | Case | Result |
|---:|---|---|
| 1 | New draft with null concurrency token | **Passed** through the real Admin Blog UI |
| 2 | Direct creation as published rejected | **Passed** (`22023`) in the earlier hosted gate |
| 3 | First publication | **Passed** through the real Admin UI with managed primary media |
| 4 | Published → Draft with null incoming date | **Passed** |
| 5 | Unpublish retains original publication date | **Passed**; `published_at` and `first_published_at` remained unchanged |
| 6 | Republish | **Passed** |
| 7 | Republish retains original publication date | **Passed**; both timestamps remained unchanged |
| 8 | Published-date mutation | **Passed** (`22023`) |
| 9 | Published-slug mutation | **Passed** (`22023`); the earlier draft-only slug edit also passed |
| 10 | Stale update | **Passed** (`PT409`) with reload guidance and no overwrite |
| 11 | Malformed top-level sections | **Passed** (`22023`) |
| 12 | Malformed top-level images | **Passed** (`22023`) |
| 13 | Malformed section paragraphs | **Passed** (`22023`) |
| 14 | Decimal width | **Passed** (`22023`) |
| 15 | Decimal height | **Passed** (`22023`) |
| 16 | Oversized numeric dimension | **Passed** (`22023`) |
| 17 | Missing Storage object | **Passed** (`22023`) |
| 18 | Cross-post media path | **Passed** (`22023`) |
| 19 | Retain existing external image in a real draft | **Accepted by final authorization decision as previously covered**; static RPC inspection confirms the narrow existing-draft retention branch. The rejected identity-impersonation transaction was not retried. |
| 20 | Newly introduced external image | **Passed** (`22023`) |
| 21 | Publish external image | **Passed** (`22023`) |
| 22 | Second published featured article | **Passed** with controlled `22023` using two disposable articles |
| 23 | Featured race defense | **Passed structurally**; `blog_one_published_featured` remains a partial unique index on `featured` where status is published and featured is true |
| 24 | Customer save denied | **Pending due to Supabase Auth rate limiting.** A later dedicated retry with a fresh disposable address still returned `email rate limit exceeded`; no authenticated customer session was created and no impersonation was attempted. |
| 25 | Anonymous save denied | **Passed**; RPC execution is revoked and the hosted call returned `401` / `42501` |
| 26 | Admin / super-admin save allowed | **Satisfied under the final decision:** super-admin runtime saves passed. No ordinary Admin browser session exists, while `private.is_admin()` explicitly admits both `admin` and `super_admin`, authenticated EXECUTE is present, and direct table writes remain revoked. |

## Publication and media lifecycle

The real Admin UI created one clearly named disposable article, uploaded a valid 64×64 PNG, saved its canonical `storage://percent-blog-images/posts/{post_uuid}/{64hex}.png` reference, published it, unpublished it and republished it. The first `published_at` value and `first_published_at` marker survived both transitions unchanged. The article was returned to Draft before cleanup.

Anonymous `public_sign` behavior was verified while the disposable article was live:

- exact referenced managed path: **200**, signed URL returned
- arbitrary path: **400**
- path belonging to another post: **400**
- syntactically valid but unreferenced path: **404**

After unpublishing, the previously signable exact path returned **404 Article unavailable**. Admin draft preview signing worked. The bucket remained private, had no anonymous Blog-object SELECT policy, and returned to zero objects. Browser roles retain no direct Blog table writes; `anon` cannot execute `save_blog_post`; `authenticated` can execute it but the function performs its internal Admin check.

## Public URL and authority behavior

The hosted row became anonymously eligible while published, as proven by the successful exact public-media signing and published-only database policies. The rendered `/blog/:slug` route continued to show Story Not Found for the disposable slug because `blogAuthority` remains intentionally `source`. The final authorization decision explicitly defers managed public-route rendering until the real content-acceptance cutover, so this is not a Phase 8 readiness blocker.

Backend failure remains distinct from a successful zero-row response. The Journal stays source-authoritative until the nine real stories and their media are deliberately migrated and accepted.

## Admin UI and quality checks

The Admin routes `/admin/blog`, `/admin/blog/new` and `/admin/blog/:id/edit` provide list/search/category/status/sort, structured content editing, managed media, immutable post-publication slug/date UI, real shared-component preview and PT409 guidance. The obsolete universal 100-piece draft remains visibly blocked from publication until its copy is reconciled.

Validation completed:

- authenticated hosted malformed-document harness: passed all executed cases
- publication/unpublication/republish lifecycle: passed
- positive and negative media signing: passed
- featured conflict and unique-index verification: passed
- fixture cleanup and exact final counts: passed
- ESLint: passed
- TypeScript (`tsc -b` through production build): passed
- Vite production build: passed
- `git diff --check`: passed; only line-ending warnings were emitted

Security Advisor still reports the expected `authenticated_security_definer_function_executable` warning for `save_blog_post`. This grant is intentional because the fixed-search-path function checks `auth.uid()` and `private.is_admin()` internally. The remaining advisor findings are pre-existing storefront RPC, RLS-without-policy, other authenticated security-definer functions, and leaked-password-protection notices.

## Required remaining action

The only remaining readiness item is case 24. Supabase Auth must allow one normal storefront customer signup, or an existing dedicated customer must sign in through the storefront. That customer session will be used only to confirm published Journal access and denial of Admin Blog access, `save_blog_post`, media upload, Admin draft signing, cleanup and direct table writes.

The authorized disposable signup was retried through the normal storefront after a later cooldown, using a fresh disposable address, and still returned `email rate limit exceeded`. It did not create a usable customer session. The permanent super-admin session was restored afterward. No existing identity or role was changed, and no unsafe Auth-table deletion or impersonation was attempted.

Because customer denial remains unverified, the checkpoint **PHASE 8 — BLOG MANAGEMENT READY FOR CONTENT ACCEPTANCE** has not been declared. Phase 9, Razorpay, Delhivery and real-article publication were not started.
