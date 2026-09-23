# Percent Admin Phase 6 — Review Visibility SQL Gate

Date: 21 September 2026  
Verified target: Percent (`gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`)  
Status: **PHASE 6 — REVIEW VISIBILITY SQL READY**

No hosted SQL was executed. The unrelated `spacetees` project was not accessed.

## Deployment audit

Hosted catalog inspection confirms `private.review_moderation_history` and `public.moderate_product_review(uuid,text,timestamptz)` exist. The old migration was therefore executed through manual SQL even though version `20260921170000` is absent from Supabase's migration-history list. The executed file remains unchanged.

## Follow-up migration

`supabase/migrations/20260921180000_admin_review_visibility.sql`

The migration removes the old generic moderation RPC and adds `public.set_product_review_visibility(uuid,boolean,timestamptz)`. It creates no table, column, index, schema, or new history system.

## State model

- `pending` = New / Not Shown; Show changes it to `approved`; Hide is a no-op.
- `approved` = Shown; Hide changes it to `rejected`; Show is a no-op.
- `rejected` = Hidden; Show changes it to `approved`; Hide is a no-op.
- No visibility operation can write `pending`.
- Every request checks `expected_updated_at`; stale requests raise `PT409` before mutation or no-op resolution.

## Security and history

The security-definer RPC derives the actor from `auth.uid()`, requires `private.is_admin()`, uses a fixed empty `search_path`, locks one review, and updates only `status`. Only `authenticated` can execute it; customer callers still fail the server-side admin check. The deployed immutable `private.review_moderation_history` table records only actual status transitions and safely supports `rejected → approved`.

The private `percent-review-images` bucket remains unchanged. Existing public signing stays limited to approved reviews on visible active/archived products. Existing authenticated `admin_read` signs only paths attached to the requested review after the trusted admin-role check, so pending, shown, and hidden images remain inspectable by admins without exposing the bucket or a service key.

## Structural impact

- New tables: **0**
- New columns: **0**
- New indexes: **0**
- New public RPCs: **1**
- Removed public RPCs: **1**
- Hosted writes during preparation: **0**

## Local verification

`node supabase/test-admin-reviews.mjs` passed pending→show, shown→hide, hidden→show, same-state no-op/history behavior, customer and anon denial, admin and super-admin access, stale `PT409`, public visibility, protected customer content, immutable history, and removal of the old RPC.

`node supabase/test-review-media-admin.mjs` passed the existing private-media contract: public approval gate retained; `admin_read` requires a trusted role and signs only paths for the requested review for 300 seconds.

## Complete SQL
```sql
begin;

-- Replace the deployed decision-oriented RPC with a visibility-only contract.
-- The existing private history table safely records both hide and re-show
-- transitions, so no second audit table is needed.
revoke all on function public.moderate_product_review(uuid, text, timestamptz)
from public, anon, authenticated, service_role;

drop function public.moderate_product_review(uuid, text, timestamptz);

create function public.set_product_review_visibility(
  review_id uuid,
  visible boolean,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_review public.product_reviews;
  saved_review public.product_reviews;
  target_status text;
begin
  if caller_id is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if visible is null then
    raise exception 'Visibility is required' using errcode = '22023';
  end if;

  select *
  into current_review
  from public.product_reviews
  where id = review_id
  for update;

  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;

  if current_review.updated_at is distinct from expected_updated_at then
    raise exception 'Review changed; refresh and retry' using errcode = 'PT409';
  end if;

  target_status := case
    when visible then 'approved'
    when current_review.status = 'approved' then 'rejected'
    else current_review.status
  end;

  -- pending + hidden, rejected + hidden, and approved + shown are already in
  -- the requested visibility state. Return the current row without generating
  -- a transition or touching updated_at.
  if target_status = current_review.status then
    return jsonb_build_object(
      'id', current_review.id,
      'visible', current_review.status = 'approved',
      'status', current_review.status,
      'updated_at', current_review.updated_at,
      'changed', false
    );
  end if;

  update public.product_reviews
  set status = target_status
  where id = current_review.id
  returning * into saved_review;

  insert into private.review_moderation_history (
    review_id,
    actor_id,
    previous_status,
    next_status
  ) values (
    current_review.id,
    caller_id,
    current_review.status,
    saved_review.status
  );

  return jsonb_build_object(
    'id', saved_review.id,
    'visible', saved_review.status = 'approved',
    'status', saved_review.status,
    'updated_at', saved_review.updated_at,
    'changed', true
  );
end;
$$;

revoke all on function public.set_product_review_visibility(uuid, boolean, timestamptz)
from public, anon, authenticated, service_role;

grant execute on function public.set_product_review_visibility(uuid, boolean, timestamptz)
to authenticated;

commit;
```
