# Percent Admin Phase 6 — Backend Change Required

Date: 21 September 2026  
Verified target: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`)  
Status: **PHASE 6 — BACKEND CHANGE REQUIRED**

No hosted SQL was executed. The unrelated `spacetees` project was not accessed.

## 1. Exact current review architecture

- `public.product_reviews` stores one review per `(user_id, product_id)`. Rating is constrained to 1–5, title to 100 characters, body to 1–1200 trimmed characters, and status to `pending`, `approved`, or `rejected`. New rows default to `pending`.
- `public.review_images` stores up to three ordered image references per review. Object paths are unique.
- `percent-review-images` is a private 5 MB JPG/PNG/WebP bucket. It currently contains no objects.
- The deployed `percent-review-media` Edge Function validates the authenticated review owner and image bytes before using its service credential for uploads. Its anonymous `read` action signs images only for approved reviews on visible active/archived products.
- Anonymous storefront reads are limited by RLS to approved reviews on visible active/archived products. Customers can read their own reviews and edit/delete only their own pending review rows. Admins currently have read-only review and image metadata access.
- The public PDP explicitly queries only `status = 'approved'`. The customer form inserts as the authenticated user, uses the profile display name, and leaves the hosted default status as `pending`.
- `private.audit_logs` receives the existing `product_reviews` update trigger, but stores only actor, table, operation, row ID, and timestamp.
- Hosted review count is zero, so no fake hosted review was created for testing.

## 2. Exact missing capability

There is no server-authoritative moderation write path. Authenticated admins have SELECT only, and no moderation function exists. The generic audit log cannot record previous/new status, so it does not satisfy the required moderation history. The current Edge Function can sign approved imagery for the public but has no authenticated admin-read action for pending/rejected imagery.

## 3. Smallest proposed backend change

- One private immutable transition table recording review ID, actor, previous status, next status, and timestamp.
- One narrowly scoped `public.moderate_product_review` RPC. It derives the actor from `auth.uid()`, verifies `private.is_admin()`, locks the target row, performs optimistic concurrency, updates only `status`, and writes the immutable history record in the same transaction.
- One queue index for bounded admin status/date pagination.
- After the SQL gate, extend the existing `percent-review-media` function with an authenticated admin-only image-read action. This reuses the private bucket and service-side signing; no Storage policy loosening is required.

No rejection-reason column is proposed. Phase 6 requires approve/reject moderation but does not require a persisted customer-facing reason, so adding one would expand the schema without a demonstrated need.

## 4. Migration

`supabase/migrations/20260921170000_admin_review_moderation.sql`

The migration file contains the complete SQL to execute. Run that exact file manually against only `gijyjdeohvdrnvqfqdha`.

## 5. Complete SQL

```sql
begin;

create table private.review_moderation_history (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  previous_status text not null check (previous_status in ('pending', 'approved', 'rejected')),
  next_status text not null check (next_status in ('approved', 'rejected')),
  created_at timestamptz not null default now(),
  check (previous_status <> next_status)
);

alter table private.review_moderation_history enable row level security;
revoke all on private.review_moderation_history from public, anon, authenticated;
grant all on private.review_moderation_history to service_role;

create function private.prevent_review_moderation_history_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Review moderation history is immutable' using errcode = '42501';
end;
$$;
revoke all on function private.prevent_review_moderation_history_change() from public, anon, authenticated;

create trigger immutable_review_moderation_history
before update or delete on private.review_moderation_history
for each row execute function private.prevent_review_moderation_history_change();

create function public.moderate_product_review(review_id uuid, next_status text, expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  current_review public.product_reviews;
  saved_review public.product_reviews;
begin
  if caller_id is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if next_status not in ('approved', 'rejected') then
    raise exception 'Unsupported review status' using errcode = '22023';
  end if;

  select * into current_review
  from public.product_reviews
  where id = review_id
  for update;
  if not found then raise exception 'Review not found' using errcode = 'P0002'; end if;
  if current_review.updated_at is distinct from expected_updated_at then
    raise exception 'Review changed; refresh and retry' using errcode = 'PT409';
  end if;
  if not (
    (current_review.status = 'pending' and next_status in ('approved', 'rejected'))
    or (current_review.status = 'approved' and next_status = 'rejected')
  ) then
    raise exception 'Review status transition is not allowed' using errcode = '22023';
  end if;

  update public.product_reviews set status = next_status
  where id = current_review.id returning * into saved_review;
  insert into private.review_moderation_history(review_id, actor_id, previous_status, next_status)
  values(current_review.id, caller_id, current_review.status, saved_review.status);
  return jsonb_build_object('id',saved_review.id,'status',saved_review.status,'updated_at',saved_review.updated_at);
end;
$$;

revoke all on function public.moderate_product_review(uuid, text, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.moderate_product_review(uuid, text, timestamptz) to authenticated;

create index admin_review_moderation_queue
on public.product_reviews(status, created_at desc, id desc);

commit;
```

## 6. Moderation transition model

- `pending → approved`: allowed.
- `pending → rejected`: allowed.
- `approved → rejected`: allowed as explicit post-publication removal.
- `approved → pending`: denied.
- `rejected → approved/pending`: denied; rejection is terminal in Phase 6.
- Same-state writes and unsupported states: denied.
- Stale `updated_at`: rejected with `PT409`.

## 7. RLS and security model

- The function accepts no actor ID and derives identity exclusively from `auth.uid()`.
- Only `authenticated` receives execute permission; `PUBLIC`, `anon`, and `service_role` are explicitly revoked.
- The function performs the existing private role check and uses a fixed empty `search_path` with fully qualified objects.
- It locks exactly one review and updates only its status.
- The private history table has RLS enabled and no browser policies or browser grants.
- Existing customer INSERT/UPDATE/DELETE and public SELECT policies remain unchanged.

## 8. Image security behavior

The bucket remains private. Anonymous public image signing remains limited to approved reviews on visible active/archived products. Pending/rejected images remain unavailable anonymously. The subsequent Edge Function change will authenticate the caller, resolve the server-authoritative role, and sign only the requested review's images for admin/super-admin inspection.

## 9. Rollback implications

Before production moderation occurs, rollback can drop the RPC, trigger/helper, index, and history table. After moderation begins, dropping the history table would destroy required audit evidence and should not be treated as a safe rollback. The review status changes themselves remain in `product_reviews`.

## 10. Structural impact

- New schemas: **0**
- New public tables: **0**
- New private tables: **1**
- New columns on existing tables: **0**
- New public RPCs: **1**
- New indexes: **1**
- Hosted data inserted by this preparation: **0**

After the SQL is executed manually, Phase 6 can continue with hosted verification, the admin-only image signing action, Reviews UI, local rollback moderation tests, responsive/accessibility checks, and the final completion report.
