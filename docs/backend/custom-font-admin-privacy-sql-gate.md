# Custom Font Library — Admin metadata privacy SQL gate

## Why this gate exists

The latest continuation prohibits exposing private font Storage paths, SHA or internal Storage metadata to **browser code**. This is stricter than the original foundation requirement, which explicitly allowed the full Admin catalog. A clarification was requested; no answer arrived during this work. This migration follows the latest literal restriction, including authenticated Admin browser responses. If the restriction was intended only for public storefront responses, the original approved Admin catalog can remain and this privacy migration is unnecessary.

The approved foundation currently returns `storage_path`, `mime_type`, `byte_size` and `sha256` through `get_website_editor()` and font-save responses. Its authenticated delete RPC also returns `cleanup_paths`. Client-side filtering would leave those fields in the browser network response.

Prepared exactly one additional migration, **unapplied**:

`supabase/migrations/20261002170636_website_font_admin_metadata_privacy.sql`

It:

- Preserves the existing Admin catalog function OID and permissions, while serializing only friendly family metadata and opaque face ID/weight/style.
- Adds a private full server catalog and a service-only `get_website_font_management_catalog()` RPC for the existing Edge media function.
- Removes private cleanup paths from the authenticated delete response. Edge must capture the authoritative server catalog before deletion and remove bytes using Storage API afterward.
- Preserves Admin authorization, PT409, live-family protection, existing delivery resolver, tables, RLS, bucket settings and saved content.
- Fails closed if the verified foundation functions drift or new helper names already exist.

The prior gate's `20261002164813_website_font_delivery_resolver.sql` is now installed and verified. No hosted SQL writes, migration repair or db push occurred in this continuation.

## Requested 32-point implementation report

1. **Hosted resolver:** Exact signature `get_website_font_delivery_asset(uuid) → jsonb`; owner postgres; SECURITY DEFINER; empty search_path; expected managed-face/in-use checks. See `custom-font-resolver-hosted-verification.json`.
2. **Resolver authorization:** Hosted service-role execution succeeds for an unknown UUID, returning null. Actual hosted anon/authenticated calls fail with 42501. No PUBLIC grant exists. Customer/Admin/Super Admin browser sessions use authenticated SQL access and are denied; local tests also cover their Percent/Firebase claims. No live authenticated browser token was used.
3. **Edge upload:** Integration pending at the SQL gate.
4. **Edge delivery:** Integration pending; the required resolver is installed.
5. **WOFF2 validation:** Added a reusable server validation core and a legal local-font decoding test. It checks extension, MIME, 2 MiB size, WOFF2 header/bounds, decodability callback, SHA-256 and canonical family/weight/style path. It is not wired into the deployed Edge upload flow yet. Production decoder resource limits remain part of that integration.
6. **Cache/CORS:** Stable public endpoint headers remain pending integration.
7. **Built-ins:** Twelve families packaged previously; ten self-hosted Fontsource families plus two system families. Existing browser asset test decoded all 87 WOFF2 files and confirmed distinct rendered samples.
8. **Custom Font Library UI:** Pending.
9. **Upload UX:** Pending.
10. **Multi-face support:** SQL supports all nine weights and normal/italic. Validation core passes every valid target combination. UI remains pending.
11. **License UX:** Foundation SQL requires confirmation; UI remains pending.
12. **Preview:** Editor integration pending.
13. **Role selection:** UI currently retains its original three options; expanded selectors remain pending.
14. **Apply Everywhere:** Pending; no publish bypass introduced.
15. **Manage/disable/delete:** SQL protections pass. Privacy migration prepares service-side management and browser-safe deletion output; Edge cleanup/UI remain pending.
16. **Custom font-face rules:** Pending. Existing bundled rules use swap and isolated names.
17. **Fallback:** Existing registry has safe fallback stacks; custom runtime integration remains pending.
18. **Active-only loading:** Pending runtime integration. No global imports of all font assets were added.
19. **Media Library:** Existing image path filters exclude fonts; unchanged.
20. **Admin/storefront isolation:** No typography application changes made; requested runtime isolation implementation remains pending.
21. **Security:** Hosted resolver permissions verified. Twenty-two local SQL groups cover existing Admin/customer/anonymous authorization, service-only metadata access, opaque IDs, disabled/unused/missing assets, deletion protection, PT409, unchanged data/grants and full transactional privacy rollback. Deployed Edge upload/delivery security matrix remains pending.
22. **Responsive:** No new UI at this gate; requested twelve-width editor checks remain pending.
23. **Built-in verification:** Existing recorded actual browser decoding/distinct rendering results remain valid; no font assets changed this continuation.
24. **Live reversible acceptance:** Not started. No hosted custom family, face or font Storage fixture was created.
25. **Storefront regression:** Hosted settings and full public storefront content exactly match the prior captured snapshot. Route/layout/font runtime regression remains pending.
26. **Files this continuation:** One privacy migration; server validation core; WOFF2 test; hosted resolver verification snapshot; extended SQL preflight tests/results; this report; pinned development Fontkit dependency and lockfile. Unrelated Blog edits were preserved.
27. **Tests:** 22 disposable SQL groups PASS. WOFF2 test PASS using locally bundled OFL Inter and Fontkit 2.0.4; invalid signature/content/length/MIME/extension/size and unsafe targets rejected. SQL tests use real historical migrations and Auth/Storage boundary shims, not deployed Edge execution.
28. **TypeScript:** PASS.
29. **ESLint:** PASS.
30. **Production build:** PASS; task-specific temporary output, no tracked dist overwrite.
31. **git diff --check:** PASS for tracked changes and newly prepared files.
32. **Remaining blocker:** Manual review/execution of this migration under the literal browser-metadata restriction. Edge/UI/runtime implementation and live acceptance remain unfinished. The user's SQL gate requires stopping here.

## Local validation commands

```powershell
$env:PERCENT_FONT_REGISTRY_MIGRATION='20261002162427_expanded_builtin_font_registry.sql'
$env:PERCENT_FONT_DELIVERY_MIGRATION='20261002164813_website_font_delivery_resolver.sql'
$env:PERCENT_FONT_PRIVACY_MIGRATION='20261002170636_website_font_admin_metadata_privacy.sql'
node supabase/test-custom-font-sql-preflight.mjs
node scripts/test-woff2-validation.mjs
```

Manual installations are not recorded in the hosted migration history. Continue deliberate reconciliation later; do not repair history or run blanket db push.
