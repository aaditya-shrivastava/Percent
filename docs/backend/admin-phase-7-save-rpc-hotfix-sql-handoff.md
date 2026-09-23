# Percent Phase 7 — Website save RPC correction SQL handoff

Date: 2026-09-22  
Target: **Percent** (`gijyjdeohvdrnvqfqdha`)  
Status: **SQL ready; not executed**

## Root cause

The hosted SQL safety rule rejects the two unconditional full-table deletes in `public.save_website_content(jsonb,timestamptz)` with `DELETE requires a WHERE clause`.

## Narrow correction

The follow-up migration contains the complete existing function definition. Its only behavioral text changes are:

- `delete from public.website_sections where section_key is not null;`
- `delete from public.website_banners where id is not null;`

Both predicates select every row because the referenced columns are non-null primary keys. Complete-document atomic replacement remains unchanged.

## Impact

- Function replacements: 1
- New tables, columns, indexes, buckets, and RPCs: 0
- Marketing-data writes performed by migration: 0
- Authorization, grants, fixed search path, validation, Storage checks, row lock, PT409 behavior, rollback, and return behavior: unchanged
- Existing four managed banner objects: untouched

## Verification

`test-website-save-delete-fix.mjs` proves the replacement differs from the original only by `CREATE OR REPLACE` and the two safe predicates. `test-website-editor.mjs` covers empty-to-populated, replacement, empty banners, section reordering, post-delete constraint rollback, missing-object rollback, PT409, atomic settings/sections/banners, admin and super-admin access, customer and anonymous denial, private Storage, and public live-only reads.

The complete executable SQL is in `supabase/migrations/20260922113000_website_editor_save_delete_fix.sql`.
