begin;

-- The generic private.audit_logs trigger records that a review changed, but it
-- cannot preserve the moderation transition. Keep the minimal review-specific
-- transition record private and immutable.
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
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Review moderation history is immutable' using errcode = '42501';
end;
$$;

revoke all on function private.prevent_review_moderation_history_change() from public, anon, authenticated;

create trigger immutable_review_moderation_history
before update or delete on private.review_moderation_history
for each row execute function private.prevent_review_moderation_history_change();

-- One narrow server-authoritative write path. It changes only status, derives
-- the actor from auth.uid(), locks the review, and rejects stale editors.
create function public.moderate_product_review(
  review_id uuid,
  next_status text,
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
begin
  if caller_id is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if next_status not in ('approved', 'rejected') then
    raise exception 'Unsupported review status' using errcode = '22023';
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

  if not (
    (current_review.status = 'pending' and next_status in ('approved', 'rejected'))
    or (current_review.status = 'approved' and next_status = 'rejected')
  ) then
    raise exception 'Review status transition is not allowed' using errcode = '22023';
  end if;

  update public.product_reviews
  set status = next_status
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
    'status', saved_review.status,
    'updated_at', saved_review.updated_at
  );
end;
$$;

revoke all on function public.moderate_product_review(uuid, text, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.moderate_product_review(uuid, text, timestamptz)
to authenticated;

create index admin_review_moderation_queue
on public.product_reviews (status, created_at desc, id desc);

commit;
