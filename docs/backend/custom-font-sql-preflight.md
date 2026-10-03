# Custom font SQL preflight

Migration: `supabase/migrations/20261002152812_website_custom_font_library.sql`.
Status: reviewed and tested locally; **UNAPPLIED on hosted Percent**.
No hosted writes, database push, frontend implementation or Edge implementation occurred.

## Hosted baseline and fail-closed guards

Read-only catalog inspection of `gijyjdeohvdrnvqfqdha` captured all three deployed
Website Editor RPC definitions in `supabase/fixtures/custom-font-hosted-preflight.json`.
They exactly match the historical migration replay. All are owned by `postgres`,
are SECURITY DEFINER, return JSONB, and use an empty search path. The readers are
STABLE and the save RPC is VOLATILE. The public reader grants EXECUTE to anon and
authenticated; editor/save grant it only to authenticated, plus the owner.

The migration checks exact normalized definition fingerprints, ownership,
volatility, language, search path, ACLs, absence of overloads, dependencies and
reserved wrapper names before making changes. CRLF normalization is the only
definition normalization. A legitimate subsequent RPC change requires a new
read-only audit and deliberate guard update, not bypassing the guard.

Hosted `pg_depend` contains only the expected outgoing schema/language dependencies
and no incoming catalog dependencies on these RPCs. Unexpected views, policies,
triggers or other recorded dependents cause the migration to fail closed. Local
tests confirm the moved functions retain their OIDs and original bodies, with only
their namespace dependency changed. All unrelated public RPC ACLs remain unchanged.
The recreated public signatures preserve existing PostgREST calls; a transactional
`NOTIFY pgrst, 'reload schema'` requests schema refresh on successful commit.

Real calls exercise this non-recursive chain:

`public.save_website_global_settings` -> private legacy save -> public editor wrapper
-> private legacy editor. The public content reader similarly delegates to its
private original. The existing Website content save RPC also still works.

## Runtime versus management metadata

Anonymous/authenticated storefront readers receive only active referenced families:

```json
{
  "font_families": [
    {
      "id": "<family UUID>",
      "family_name": "<display name>",
      "faces": [{"asset_id": "<opaque face UUID>", "weight": 400, "style": "normal"}]
    }
  ]
}
```

They do not receive canonical Storage paths, hashes, byte sizes, MIME implementation
details, timestamps, enabled flags or in-use flags. A separate private serializer
serves Admin management metadata, retaining those fields and opaque asset IDs.
Replacing an unused face changes its asset identifier; an idempotent repeat retains
the identifier. The future font-serving endpoint must resolve IDs internally and
check active references. It is not implemented in this SQL-only task.

## Rollout, storage and authorization

Only the current approved `Inter`, `Georgia` and `system-ui` built-ins are accepted.
All expanded but unbundled names are rejected. The current Admin selector still
offers only the original three names. Migration execution never writes typography
or content and never seeds fonts. Expanded built-ins require a coordinated bundled
asset release and validator update; they must not be enabled ahead of assets.

The hosted website-media bucket is private, has a 10 MiB limit, and allows exactly
image/jpeg, image/png and image/webp. Strict preflight checks verify this baseline.
The migration appends font/woff2, preserving privacy, size and all image MIME types.
It does not alter Storage policies or objects. The only hosted Storage policies are
for product image signing and authenticated review-image delivery; neither grants
website-media object access. Existing Website media is delivered through the
authorized Edge Function and signed URLs. Font internals remain excluded from its
image-only Media Library. Font delivery and CORS acceptance await the later Edge phase.

New tables enable RLS and grant no direct browser/service CRUD. Management RPCs grant
EXECUTE only to authenticated and additionally require Percent's internal principal
resolver plus Admin/Super Admin authorization. Customer, anon-role and authenticated
anonymous-provider tokens are denied. Private helpers and legacy RPCs have no client
EXECUTE privileges. No browser service-role credential is introduced.

All global/font management writes lock the existing storefront singleton first,
serializing reference changes with disable/delete/face removal. Global saves retain
the existing strict validation and PT409 protection. Family operations use their own
expected updated_at. Active families cannot be disabled/deleted or have faces removed
or replaced; renaming by stable UUID and adding faces are safe. Unused faces/families
can be managed and deleted. Physical object deletion belongs to the Storage API,
not SQL. WOFF2 byte/signature/decoder validation likewise belongs to the later Edge
upload boundary; SQL validates canonical metadata and Storage object existence.

Unique normalized-name, family/weight/style, canonical-path and opaque-asset indexes
cover the actual lookups. Live references scan the existing single settings row;
no speculative JSON or live-reference index is added.

## Validation

Run: `node supabase/test-custom-font-sql-preflight.mjs`.
The dedicated test uses disposable PGlite PostgreSQL with real historical migrations
and Percent authorization. Only Supabase Auth/Storage service boundaries are shimmed.
It applies the complete pending migration locally and exercises 19 passing groups:

- Exact hosted RPC definitions, properties, grants and bucket baseline.
- Rollback after MIME update, RPC moves and final DDL: original locations, grants,
  MIME configuration, tables, helpers and policies are fully restored.
- Closed failure for definition, owner, SECURITY DEFINER, volatility, search-path,
  grant, overload, dependency and bucket configuration drift.
- Full DDL compile, generated columns, constraints, wrappers, grants and RLS.
- Zero changes to every existing application table, including content, branding,
  colors, navbar/footer, Blog, media objects and customer/auth data. Only the expected
  bucket MIME append differs; custom tables are empty after migration.
- Preserved OIDs/dependencies and unchanged unrelated RPC privileges.
- Real existing Website content-save call through the recreated editor wrapper.
- Unchanged typography saves, Inter/Georgia/system-ui saves, rejection of unbundled,
  nonexistent, deleted, disabled or missing-object references, and stale PT409 saves.
- Admin/Super Admin success; customer and both forms of anonymous caller denial.
- All 100-900 weights, italic faces and idempotent saves.
- Duplicate names across case/whitespace, malformed faces, invalid weight/style/MIME,
  oversized/empty metadata, bad SHA/path, absent objects, duplicate faces and missing
  license confirmation are denied.
- Active disable/delete/remove/replace denial; safe rename/add and unused management.
- Minimal public payload versus complete Admin payload, exact grants and RLS.
- Required indexes only.

Detailed results: `docs/backend/custom-font-sql-preflight-results.json`.
Final hosted read-only confirmation: `docs/backend/custom-font-sql-unapplied-confirmation.json`.
TypeScript, ESLint, production build and whitespace checks passed. Existing unrelated
Blog-card work was retained; this task changed only SQL/test/audit files.
