begin;

-- Existing private.audit_logs records only the table/operation/row ID. It
-- cannot hold old/new lifecycle values, reason, or an immutable internal note.
create table public.order_lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  dimension text not null check (dimension in ('order_status','fulfillment_status')),
  previous_value text not null,
  next_value text not null,
  reason text,
  internal_note text,
  created_at timestamptz not null default now(),
  check (previous_value <> next_value),
  check (
    (dimension='order_status'
      and previous_value in ('pending','confirmed','cancelled','completed')
      and next_value in ('pending','confirmed','cancelled','completed'))
    or
    (dimension='fulfillment_status'
      and previous_value in ('unfulfilled','processing','shipped','out_for_delivery','delivered','cancelled','returned')
      and next_value in ('unfulfilled','processing','shipped','out_for_delivery','delivered','cancelled','returned'))
  ),
  check (reason is null or (length(reason) between 1 and 500 and reason=btrim(reason))),
  check (internal_note is null or (length(internal_note) between 1 and 2000 and internal_note=btrim(internal_note))),
  check (next_value<>'cancelled' or dimension<>'order_status' or reason is not null)
);

create index order_lifecycle_history_order_created_idx
  on public.order_lifecycle_history(order_id,created_at,id);

alter table public.order_lifecycle_history enable row level security;
revoke all on public.order_lifecycle_history from public,anon,authenticated;
grant select on public.order_lifecycle_history to authenticated;
grant all on public.order_lifecycle_history to service_role;
create policy admin_read on public.order_lifecycle_history
  for select to authenticated using ((select private.is_admin()));
create trigger immutable_order_lifecycle_history
  before update or delete on public.order_lifecycle_history
  for each row execute function private.immutable_snapshot();

create or replace function public.update_order_lifecycle(
  order_id uuid,
  dimension text,
  next_status text,
  expected_updated_at timestamptz,
  reason text default null,
  internal_note text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  current_order public.orders;
  old_value text;
  old_fulfillment text;
  clean_reason text := nullif(btrim(reason),'');
  clean_note text := nullif(btrim(internal_note),'');
  actor uuid := auth.uid();
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if order_id is null or expected_updated_at is null or dimension is null or next_status is null then
    raise exception 'Order, dimension, next status and current version are required' using errcode='22023';
  end if;
  if dimension not in ('order_status','fulfillment_status') then
    raise exception 'This lifecycle dimension cannot be changed by Admin' using errcode='22023';
  end if;
  if length(clean_reason)>500 or length(clean_note)>2000 then
    raise exception 'Reason or internal note exceeds its allowed length' using errcode='22023';
  end if;

  select o.* into current_order from public.orders o where o.id=order_id for update;
  if not found then
    raise exception 'Order unavailable' using errcode='42501';
  end if;
  if current_order.updated_at is distinct from expected_updated_at then
    raise exception 'Order was updated elsewhere' using errcode='PT409';
  end if;
  if current_order.status in ('cancelled','completed') then
    raise exception 'Final orders cannot change lifecycle' using errcode='22023';
  end if;

  if dimension='order_status' then
    old_value:=current_order.status;
    if not (
      (old_value='pending' and next_status in ('confirmed','cancelled'))
      or (old_value='confirmed' and next_status in ('completed','cancelled'))
    ) then
      raise exception 'Invalid order-status transition' using errcode='22023';
    end if;
    if next_status='cancelled' then
      if clean_reason is null then
        raise exception 'Cancellation reason is required' using errcode='22023';
      end if;
      if current_order.fulfillment_status not in ('unfulfilled','processing')
         or current_order.payment_status not in ('unpaid','failed')
         or current_order.shipping_provider is not null
         or current_order.tracking_number is not null then
        raise exception 'Cancellation requires external payment or shipping review' using errcode='22023';
      end if;
      old_fulfillment:=current_order.fulfillment_status;
      update public.orders
      set status='cancelled',fulfillment_status='cancelled'
      where id=order_id returning * into current_order;
      insert into public.order_lifecycle_history
        (order_id,actor_id,dimension,previous_value,next_value,reason,internal_note)
      values (order_id,actor,'order_status',old_value,'cancelled',clean_reason,clean_note);
      insert into public.order_lifecycle_history
        (order_id,actor_id,dimension,previous_value,next_value,reason)
      values (order_id,actor,'fulfillment_status',old_fulfillment,'cancelled',clean_reason);
    elsif next_status='completed' then
      if current_order.payment_status<>'paid'
         or current_order.payment_provider is null
         or current_order.payment_reference is null
         or current_order.fulfillment_status<>'delivered'
         or current_order.shipping_provider is null
         or current_order.tracking_number is null
         or current_order.delivered_at is null then
        raise exception 'Completion requires trusted payment and delivery evidence' using errcode='22023';
      end if;
      update public.orders set status='completed'
      where id=order_id returning * into current_order;
      insert into public.order_lifecycle_history
        (order_id,actor_id,dimension,previous_value,next_value,reason,internal_note)
      values (order_id,actor,'order_status',old_value,'completed',clean_reason,clean_note);
    else
      update public.orders set status='confirmed'
      where id=order_id returning * into current_order;
      insert into public.order_lifecycle_history
        (order_id,actor_id,dimension,previous_value,next_value,reason,internal_note)
      values (order_id,actor,'order_status',old_value,'confirmed',clean_reason,clean_note);
    end if;
  else
    old_value:=current_order.fulfillment_status;
    if current_order.status<>'confirmed'
       or old_value<>'unfulfilled'
       or next_status<>'processing' then
      raise exception 'Invalid internal fulfillment transition' using errcode='22023';
    end if;
    update public.orders set fulfillment_status='processing'
    where id=order_id returning * into current_order;
    insert into public.order_lifecycle_history
      (order_id,actor_id,dimension,previous_value,next_value,reason,internal_note)
    values (order_id,actor,'fulfillment_status',old_value,'processing',clean_reason,clean_note);
  end if;

  return jsonb_build_object(
    'id',current_order.id,
    'status',current_order.status,
    'payment_status',current_order.payment_status,
    'fulfillment_status',current_order.fulfillment_status,
    'updated_at',current_order.updated_at
  );
end $$;

revoke all on function public.update_order_lifecycle(uuid,text,text,timestamptz,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.update_order_lifecycle(uuid,text,text,timestamptz,text,text)
  to authenticated;

commit;
