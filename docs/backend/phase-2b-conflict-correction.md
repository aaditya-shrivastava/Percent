# Proposed correction: stale product saves

Applied with user approval in migration 20260914000242_admin_product_conflict_signal.sql. HTTP 409/PT409 and browser conflict recovery passed. No new RPC, table, column, schema, role or policy was added. See admin-phase-2b-completion-report.md for final results; the remainder preserves the reviewed correction plan.

The real browser stale-save test exposed PostgREST retrying the custom SQLSTATE 40001. The newer saved value remained intact, but the stale caller stayed in Saving. Direct PostgreSQL tests passed because they do not exercise the HTTP retry layer.

Supabase documents this exact failure in [SQLSTATE 40001 in an RPC causes infinite retries](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Its recommended HTTP conflict code is PT409.

Change only the stale-version exception in the existing public.save_product_draft function:

```diff
- raise exception 'Product changed; reload before saving' using errcode='40001';
+ raise exception 'Product changed; reload before saving' using errcode='PT409';
```

Apply through a dedicated corrective migration with CREATE OR REPLACE FUNCTION, preserving the existing body except this code, signature, SECURITY INVOKER, search_path, grants and validation. Do not rewrite the deployed historical migration. The number of RPCs remains one.

Recognize PT409 in src/backend/admin/editor.ts; update direct SQL/PGlite conflict assertions and add authenticated HTTP verification of a prompt 409 response without retrying. Repeat the browser conflict test, retained local values, confirmation and reload.

The pending test tabs were closed. A targeted backend termination query then found no matching active backend; a separate check confirmed zero active save_product_draft requests. No project restart or unrelated connection termination occurred.

After correction, finish conflict recovery, invalid-image feedback, removal/recovery UI, final thumbnail, browser Back/discard and public draft-hiding acceptance. Verify the permanent role remains super_admin. Stop before Phase 3.
