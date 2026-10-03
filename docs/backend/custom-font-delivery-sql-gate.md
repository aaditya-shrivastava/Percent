# Custom Font Library — additional SQL approval gate

## Why another migration is required

Hosted inspection confirms that `service_role` has no SELECT grant on either font table and no EXECUTE grant on the private font catalogs. RLS bypass does not confer missing table privileges. The public catalog intentionally exposes only family identity and opaque face IDs, not Storage paths. The existing Edge function uses server-side Supabase API access, so it needs a narrowly scoped RPC to resolve an opaque ID before downloading the corresponding private font object.

Prepared **one** migration: `supabase/migrations/20261002164813_website_font_delivery_resolver.sql`. It adds `public.get_website_font_delivery_asset(p_asset_id uuid)`, executable only by `service_role`, with an empty search_path and a fixed query. It returns internal path/MIME/size/SHA information for one face only when its family is enabled, currently in use, and backed by valid Storage metadata. Browser roles cannot execute it. The future Edge response must contain font bytes, never this internal JSON.

No table privileges, existing RPC permissions, policies, bucket settings, saved typography or content are changed. The public font catalog stays minimized. This migration has **not** been executed on hosted Percent. No db push, migration repair or hosted writes occurred.

## Requested implementation report

1. **Hosted verification:** Both foundation tables exist with RLS; all twelve built-ins return true from the hosted validator. Settings exactly match the prior hosted snapshot. Current storefront content reads successfully; 7 sections, 4 banners, 10 pages and 20 page sections remain present. This confirms current availability, not a historical byte-for-byte backup comparison of all content. The private bucket retains JPEG, PNG, WebP and WOFF2 MIME types. Existing grants are intact. See `custom-font-expanded-hosted-verification.json`.
2. **Built-ins:** Twelve families are packaged. Ten Fontsource families provide 87 licensed WOFF2 files; Georgia/system-ui use system fonts. Existing asset verification decoded every file and confirmed twelve distinct browser renderings. Expanded dropdown integration remains pending.
3. **Edge upload:** Pending the SQL gate. Existing image infrastructure was not modified.
4. **WOFF2 validation:** Packaged assets were browser-decoded and hashed. Custom upload server-side validation remains pending.
5. **Delivery:** The missing server-only resolver is prepared and tested. Stable Edge byte delivery, CORS and caching remain pending.
6. **Custom Font Library UI:** Pending.
7. **Multi-weight support:** SQL foundation supports 100–900 and normal/italic; UI remains pending.
8. **License UX:** SQL confirmation is mandatory; UI remains pending.
9. **Preview:** Built-in assets were rendered in browser tests. Editor live preview remains pending.
10. **Role selectors:** Integration remains pending; current UI still offers its original three choices.
11. **Apply Everywhere:** Pending; no Save/Publish bypass introduced.
12. **Manage/disable/delete:** Existing SQL safeguards pass; management UI and Storage cleanup remain pending.
13. **Dynamic font faces:** Packaged CSS uses isolated names and swap. Custom runtime integration remains pending.
14. **Fallbacks:** Registry provides safe system/serif fallback stacks; storefront integration remains pending.
15. **Performance:** Assets occupy about 2.3 MB on disk and are not globally imported. Production active-face loading/measurement remains pending.
16. **Media Library:** Existing image path filters exclude WOFF2; no font image cards were introduced.
17. **Security:** Local tests deny browser calls to the delivery resolver, including Admin/Super Admin. Existing Admin font-management RPCs continue to accept internal Admin/Super Admin and reject customer/anonymous callers. Only the Edge service credential will resolve delivery metadata.
18. **PT409:** Existing SQL concurrency tests pass; UI feedback remains pending.
19. **Responsive:** No UI changes made at this gate; requested editor breakpoint tests remain pending.
20. **Live reversible test:** Not started. No test family or Storage objects were created on hosted Percent.
21. **Built-in visual verification:** All twelve produced distinct browser-rendered samples in `builtin-font-asset-results.json`.
22. **Storefront regression:** Settings unchanged; complete route/layout regression remains pending implementation.
23. **Migration history:** Neither manually executed migration appears in `supabase_migrations.schema_migrations`. Do not use automated migration deployment until this is deliberately reconciled. No repair was attempted.
24. **Files changed this continuation:** One new resolver migration, extended `supabase/test-custom-font-sql-preflight.mjs`, refreshed local SQL results, a new hosted read-only verification snapshot, and this report. Unrelated Blog edits were preserved.
25. **Tests:** Twenty-one local SQL groups pass, including actual service-role resolver calls, denied client calls, enabled/in-use requirements, missing/wrong MIME rejection, preserved data/function privileges, and transactional rollback after function creation/grant. Disposable PGlite uses real historical migrations with Auth/Storage boundary shims; this is not a deployed Edge integration test.
26. **TypeScript:** PASS, `npx tsc -b`.
27. **ESLint:** PASS, `npm run lint`.
28. **Production build:** PASS; output written outside tracked dist to the task-specific temporary directory.
29. **git diff --check:** Tracked changes and the new migration pass whitespace checks.
30. **Remaining blocker:** Manual SQL approval/execution of the resolver migration. The user explicitly requires stopping if another SQL change becomes necessary; full Edge/UI/runtime implementation and live acceptance remain pending.

## Reproduce local SQL checks

```powershell
$env:PERCENT_FONT_REGISTRY_MIGRATION='20261002162427_expanded_builtin_font_registry.sql'
$env:PERCENT_FONT_DELIVERY_MIGRATION='20261002164813_website_font_delivery_resolver.sql'
node supabase/test-custom-font-sql-preflight.mjs
```

The credentials needed by the eventual Edge resolver remain server-only. No service-role key was added to browser code.
