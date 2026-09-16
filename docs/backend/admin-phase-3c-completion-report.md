# Percent Admin Phase 3C completion report

Date: 2026-09-15  
Target: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`)

## Outcome

Phase 3C product publishing is complete. A draft can become active only through `public.publish_product(product_id, expected_updated_at)`. The operation rechecks every readiness condition under row locks and atomically sets the lifecycle and storefront visibility fields. No product was published during hosted verification.

## Database change

- Dedicated migration: `supabase/migrations/20260915025947_admin_product_publication.sql`
- New tables: 0
- New columns: 0
- New public RPCs: 1 (`publish_product`)
- New trigger: 1 (`guard_product_publication` on `public.products.status`)
- The user manually executed the SQL successfully on Percent.
- Hosted inspection verified the RPC owner is `postgres`, `SECURITY DEFINER` is enabled, `search_path` is empty, `anon` and `PUBLIC` cannot execute it, and `authenticated` can execute it.
- The RPC derives identity from `auth.uid()`, calls the existing private admin predicate, accepts no actor identity, and exposes no private relation.
- The trigger prevents direct authenticated Draft → Active changes and prevents Active/Archived → Draft reversal.

Because the SQL was run manually, reconcile CLI migration history before a later `db push`:

```powershell
npx --yes supabase@2.75.0 migration repair 20260915025947 --status applied --linked
```

This command was intentionally not run automatically.

## Publication rules

The database requires:

- an eligible draft with no archived or sold-out timestamp;
- complete identity, positive product price, supported fit, and active category;
- one or more enabled variants, each with size, SKU, and positive price;
- a primary, publicly deliverable HTTPS image;
- historical produced pieces exactly equal to that product's configured `production_limit`;
- at least one enabled, unsold, unwithdrawn physical unit;
- no sold unit on a draft;
- a current `updated_at` value, with stale calls returning `PT409`.

Withdrawn pieces count toward historical production. The configured per-product limit remains authoritative; 100 is not hardcoded as a global limit.

## Admin application

- Added one shared publication-readiness model used by Product Management and the Product Editor.
- Product actions link drafts to either review requirements or review and publish.
- The editor lists every readiness condition and its current counts.
- Publish remains disabled while requirements fail, while changes are unsaved, or while another operation runs.
- The confirmation dialog summarizes allocation, eligible stock, and enabled variants; supports Escape, traps keyboard focus, and restores focus on close.
- Publication calls only the atomic RPC. A `PT409` response offers Reload Latest or Stay on Page through the existing conflict flow.
- Successful publication reloads authoritative product data and exposes the existing storefront preview link.
- No unpublish, reactivate, restore, checkout, payment, shipping, or order-creation path was added.

## Verification

Local security and regression checks:

- `node supabase/test-product-publication.mjs`: pass
- `node supabase/test-product-allocation.mjs`: pass
- `node supabase/test-inventory-adjustments.mjs`: pass
- `node scripts/test-admin-products.mjs`: pass
- `node scripts/test-product-editor.mjs`: pass
- `npx tsc --noEmit --incremental false`: pass
- `npm run lint`: pass
- `npm run build`: pass
- `git diff --check`: pass

The publication test covers anonymous/customer denial, partial allocation rejection, stale concurrency rejection, direct status-bypass denial, an atomic full-run publication, allocation locking after activation, and prohibition on returning to draft.

Authenticated browser verification on the permanent super-admin session confirmed `/admin/products` and a real Product Editor route load hosted data. At 554 px the editor had no horizontal overflow, showed all readiness rows, and kept Publish disabled for a real 0/100 draft.

Final hosted state:

- real products: 27
- real drafts: 27
- real visible products: 0
- real products with inventory: 0
- verification products: 4, all hidden
- active products: 0
- orders: 0
- permanent administrator: `super_admin`, profile linked

## Advisors

The security advisor reports the new authenticated `SECURITY DEFINER` RPC as a warning. This exposure is intentional and bounded by the internal `auth.uid()` plus `private.is_admin()` check, fixed empty search path, exact arguments, and revoked anonymous/public execution. The same advisory category covers the previously approved inventory RPCs. The existing leaked-password-protection warning is unrelated to Phase 3C. See [Supabase linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Performance advisors contain pre-existing unused-index and multiple-permissive-policy notices. Phase 3C added no index or RLS policy.

## Stop point

Phase 3C is complete. Phase 4B has not been started.
