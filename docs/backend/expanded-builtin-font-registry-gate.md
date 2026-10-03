# Expanded built-in font registry — manual SQL approval gate

The foundation migration is present on hosted Percent (`gijyjdeohvdrnvqfqdha`). Both font tables exist with RLS and no direct client privileges. Public content and Admin management wrappers have the expected grants; private helpers and relocated legacy RPCs are not client-callable. The bucket is private, retains its 10 MiB limit and JPEG/PNG/WebP MIME types, and adds `font/woff2`. No font records are seeded.

The hosted settings, including all four Inter roles, match the captured preflight baseline. The public content reader succeeds; 7 home sections, 4 banners, 10 pages and 20 page sections remain present. This is a settings-baseline comparison and current-content availability check, not a byte-for-byte historical content backup comparison.

**History exception:** `supabase_migrations.schema_migrations` has no row for `20261002152812`. Manual SQL Editor execution applied the schema without registering CLI migration history. No history repair or hosted SQL writes were performed in this continuation.

## Assets ready

`public/fonts/builtin/registry.json` records the pinned Fontsource versions, licenses, supported weights/styles, paths, byte sizes and SHA-256 hashes. All supported character subsets are included. Ten downloaded families contain 87 WOFF2 files; Georgia and system-ui use platform fonts. Every file decoded in Microsoft Edge and all twelve families produced distinct rendered samples. Font rules use `font-display: swap` and isolated `PercentBuiltin_*` names, preserving current storefront/Admin appearance. No CDN requests are needed. See `builtin-font-asset-results.json`.

Reproduce the asset bundle and browser verification:

```powershell
node scripts/bundle-builtin-fonts.mjs
node scripts/test-builtin-font-assets.mjs
```

## One follow-up migration, unapplied

`supabase/migrations/20261002162427_expanded_builtin_font_registry.sql` changes only the built-in allowlist in `private.website_font_reference_valid(text)`. It checks the hosted foundation function body and privileges before replacing it. Function OID, grants, custom-family validation, existing settings and content remain unchanged. It does not alter RPC wrappers, Storage, tables, policies or migration history.

The complete historical SQL foundation suite plus the follow-up passed locally: 20 groups. This includes actual saves for all twelve built-ins, invalid-name rejection, custom-family acceptance/deletion protection, unchanged table snapshots and preserved function grants/OID. No hosted migration execution occurred.

```powershell
$env:PERCENT_FONT_REGISTRY_MIGRATION='20261002162427_expanded_builtin_font_registry.sql'
node supabase/test-custom-font-sql-preflight.mjs
```

## Work pending after this gate

The current UI still offers only Inter, Georgia and system-ui. Expanded choices are not enabled before database approval. Secure Edge upload/delivery, the Admin Custom Font Library, role/apply controls, storefront runtime integration, and live reversible upload acceptance remain unimplemented. No customer/Admin auth or storefront behavior was changed. Existing unrelated Blog edits were preserved.

TypeScript, ESLint, production build and git diff whitespace validation passed for this staged asset/SQL work. The production output contains the bundled WOFF2 assets and licenses.

Stop here under the user's explicit SQL rule. Do not deploy this follow-up migration automatically.
