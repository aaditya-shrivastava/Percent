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
