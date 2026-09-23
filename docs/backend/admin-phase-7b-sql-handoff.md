# PHASE 7B — MULTI-PAGE WEBSITE EDITOR BACKEND CHANGE REQUIRED

**Target:** Percent, `gijyjdeohvdrnvqfqdha`, ap-south-1. **Status:** review handoff. The proposed SQL has not been executed, and no hosted data was changed.

1. **Current page architecture:** Shop, Product Details, Sold Out, About, Contact, FAQ and Policies are real storefront components backed by a mix of catalog data and source-controlled presentation. The [page audit](admin-phase-7b-content-audit.md) names each component and current source.
2. **Editable map:** Page hero copy; fixed editorial sections; About/Contact imagery; Sold Out story; global PDP helper copy; FAQ categories/questions/answers; and the four existing policies' titles, introductions and ordered plain-text sections.
3. **Source-controlled map:** Catalog, product detail, reviews, prices, variants, stock, archive lifecycle, filters, forms and validation, policy route behavior, and Blog stay outside Website Editor. Home/Footer retain their existing backend contract. The audit identifies these per page.
4. **Schema extension:** One page-document table, one fixed-section table, two normalized FAQ tables, and one policy-section table. No generic CMS or arbitrary HTML.
5. **Why existing tables are insufficient:** `website_settings` holds Footer fields; `website_sections` is constrained to seven Home keys; `website_banners` is the Home carousel. Reusing them would mix unrelated page versions and allow incorrect section semantics.
6. **Tables/columns/RPCs:** `website_pages` has page key, copy, CTA, optional image metadata and page version. `website_page_sections` holds allowlisted fixed blocks. `website_faq_categories` → `website_faq_items` models FAQ. `website_policy_sections` holds titled ordered sections and text paragraphs. New RPCs: `get_storefront_page(text)`, `get_website_page_editor(text)`, `save_website_page(text,jsonb,timestamptz)`.
7. **Storage strategy:** Reuse private `percent-website-media`. The existing Edge Function must be extended separately for `pages/{page_key}/{sha256}.{jpg|png|webp}` uploads, admin preview signing, live-reference public signing and cleanup protection. Keep magic-byte checks, role checks and short expiry. Do not enable page image controls until this is done.
8. **Public read:** `get_storefront_page(page_key)` returns null before the first managed save; otherwise it returns page presentation and only enabled sections/FAQ entries. It does not return product or customer data. Each public component retains its source-controlled bootstrap until its own first save.
9. **Admin read/write:** Admin RPCs require `auth.uid()` and the existing `private.is_admin()` role check. Direct table permissions remain revoked from `anon` and `authenticated`. All writes are scoped to the selected page; FAQ replacement is scoped to the FAQ save; policy sections are scoped to one policy.
10. **Draft/save:** Browser draft changes stay local and enter the same-origin iframe preview through postMessage. Save is explicit and atomic. No persisted draft or fake Publish state is introduced.
11. **Concurrency:** Each page row has its own `updated_at`. Save locks the page, compares the caller token with the current value using null-safe comparison, and raises `PT409` on conflict. Separate policy pages cannot conflict with one another. Home/Footer keep their current token.
12. **Migration filename:** `supabase/migrations/20260923120000_admin_website_pages.sql` (prepared only).
13. **Complete SQL:** [Unexecuted migration](../../supabase/migrations/20260923120000_admin_website_pages.sql). This file is the complete SQL to review and execute manually on the verified Percent project. Do not execute it against any other project.
14. **RLS/security:** RLS is enabled on every new table. No direct anon/authenticated table access or policies. Narrow `SECURITY DEFINER` RPCs use `search_path = ''`, fully qualified objects, fixed page allowlists, local CTA validation and plain-text constraints. Public role gets only the read RPC; authenticated gets Admin RPC execution but the functions independently check admin role. No browser service key.
15. **Structural impact:** Five new tables, three RPCs, zero existing table/column changes, zero data seeds. No product, inventory, order, payment or shipping schema changes. SQL alone does not implement the UI or media Edge Function extension.
16. **Rollback:** Back up managed page rows and referenced media first. Remove the three RPCs, then drop the five new tables in dependency order. Public pages must fall back to source-controlled presentation when page rows disappear. Existing Home/Footer data is unaffected. Any Phase 7B managed edits would be lost.

**Review notes:** No hosted connection was used for this gate; the design is based on the local migrations and application code. Before any hosted execution, verify the project ref in the available Supabase connector and review the SQL. After manual SQL execution, Phase 7B implementation must add the Edge Function path/signing extension, shared real-page preview integration, editor controls, managed storefront reads, and security/visual tests. The current pages contain copy claiming a universal 100-piece limit in About, PDP and FAQ; that claim is inconsistent with configurable per-design production limits and should not be carried into managed content.

## SQL review correction, 23 September 2026

The same unexecuted migration now uses `WHERE item_key IS NOT NULL` and `WHERE category_key IS NOT NULL` for atomic FAQ replacement. Save checks non-null page and section image paths against `storage.objects` in `percent-website-media` before writing their references; missing objects raise `22023`. The page, section, FAQ category/item and policy section inputs reject unknown JSON fields with `22023`. JSON type checks precede array-length checks. The page-level image scope remains About/Contact, and section images remain About-only.

The following **runtime test matrix remains pending** until this migration is manually run in an isolated Percent test context. No local PostgreSQL/`psql`/Supabase CLI is available, and the instruction forbids executing SQL now. Do not label these as passing merely from static inspection.

| # | Runtime case | Expected result |
| --- | --- | --- |
| 1 | First FAQ save with null token | Saves normalized categories/items |
| 2 | FAQ replacement | Replaces old document atomically |
| 3 | Safe-delete enforcement | Predicated deletes accepted |
| 4 | Invalid replacement | Transaction rolls back old FAQ rows/version |
| 5 | Valid image path and existing Storage object | Save accepted |
| 6 | Valid-looking missing page image | `22023`, no page/version change |
| 7 | Missing About section image | `22023`, no section/version change |
| 8 | Unsupported top-level field | `22023` |
| 9 | Unsupported section field | `22023` |
| 10 | Unsupported FAQ category or item field | `22023` |
| 11 | Unsupported policy section field | `22023` |
| 12 | Non-array sections, FAQ items or policy paragraphs | `22023` |
| 13 | First save, null expected timestamp | Succeeds |
| 14 | Stale timestamp | `PT409`, no mutation |
| 15 | Save one policy while another is edited | Independent versions |
| 16 | Anonymous/customer save | `42501`, no mutation |
| 17 | Admin/super-admin save | Allowed, subject to validation |

Static review of the local SQL covers the prescribed predicates, Storage checks, field allowlists and ordered type checks. Runtime, role and transaction behavior cannot be confirmed until a database test is authorized after manual migration execution.
