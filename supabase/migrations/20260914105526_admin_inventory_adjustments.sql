-- RUN THIS ONLY IN: Percent -> SQL Editor (gijyjdeohvdrnvqfqdha).
-- Manual execution only. One new table, one column on an existing table,
-- no new schemas. Does not modify historical rows or create inventory.
begin;

create table public.inventory_adjustment_operations (
 id uuid primary key default gen_random_uuid(),
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 operation text not null check (operation in ('INCREASE','DECREASE','SET_EXACT')),
 reason text not null check (reason in (
  'Physical count correction','Damage','Quality rejection','Lost item',
  'Administrative correction','Production count correction','Other'
 )),
 internal_note text check (internal_note is null or length(internal_note) between 1 and 2000),
 before_quantity integer not null check (before_quantity >= 0),
 after_quantity integer not null check (after_quantity >= 0),
 created_at timestamptz not null default now(),
 check (before_quantity <> after_quantity),
 check ((operation = 'INCREASE' and after_quantity > before_quantity)
     or (operation = 'DECREASE' and after_quantity < before_quantity)
     or operation = 'SET_EXACT')
);

create index inventory_operations_variant_created_idx
 on public.inventory_adjustment_operations(variant_id, created_at desc, id desc);
create index inventory_operations_actor_idx
 on public.inventory_adjustment_operations(actor_id);

alter table public.inventory_adjustments
 add column operation_id uuid references public.inventory_adjustment_operations(id) on delete restrict;
create index inventory_adjustments_operation_idx
 on public.inventory_adjustments(operation_id) where operation_id is not null;

alter table public.inventory_adjustment_operations enable row level security;
revoke all on public.inventory_adjustment_operations from public, anon, authenticated, service_role;
grant select on public.inventory_adjustment_operations to authenticated;
create policy admin_read on public.inventory_adjustment_operations
 for select to authenticated using ((select private.is_admin()));
create trigger immutable_inventory_operation
 before update or delete on public.inventory_adjustment_operations
 for each row execute function private.immutable_snapshot();

-- Preserve raw unit snapshots and existing allocation/sold-out audit behavior.
-- Only the trusted RPC sets this transaction-local operation context. The
-- parent must belong to the same actor, variant and transaction timestamp.
create or replace function private.record_unit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 current_operation uuid;
 operation_reason text;
begin
 current_operation := nullif(current_setting('percent.inventory_operation', true), '')::uuid;
 if current_operation is not null then
  select o.reason into operation_reason
  from public.inventory_adjustment_operations o
  where o.id = current_operation and o.variant_id = new.variant_id
    and o.actor_id = auth.uid() and o.created_at = transaction_timestamp();
  if not found then
   raise exception 'Invalid inventory operation context' using errcode = '42501';
  end if;
 end if;
 insert into public.inventory_adjustments(unit_id, actor_id, reason, old_state, new_state, operation_id)
 values(new.id, auth.uid(),
  coalesce(operation_reason, nullif(current_setting('percent.inventory_reason', true), ''), 'Foundation inventory change'),
  case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
  to_jsonb(new), current_operation);
 if new.sold_at is not null
    and (select count(*) from public.inventory_units where product_id = new.product_id and sold_at is not null)
      >= (select production_limit from public.products where id = new.product_id) then
  update public.products set status = 'archived', archived_at = coalesce(archived_at, now()),
   sold_out_at = coalesce(sold_out_at, now()) where id = new.product_id;
 end if;
 return new;
end;
$$;
revoke all on function private.record_unit() from public, anon, authenticated, service_role;

create function public.adjust_variant_inventory(
 product_id uuid,
 variant_id uuid,
 operation text,
 quantity numeric,
 reason text,
 expected_updated_at timestamptz,
 internal_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 p public.products;
 v public.product_variants;
 before_count integer;
 after_count integer;
 produced_count integer;
 target_count numeric;
 change_count integer;
 affected_count integer;
 event_count integer;
 new_operation_id uuid;
 clean_reason text;
 clean_note text;
 previous_operation text;
begin
 if auth.uid() is null or not private.is_admin() then
  raise exception 'Admin access required' using errcode = '42501';
 end if;
 if product_id is null or variant_id is null or expected_updated_at is null then
  raise exception 'Product, variant and current version are required' using errcode = '22023';
 end if;
 if operation is null or operation not in ('INCREASE','DECREASE','SET_EXACT') then
  raise exception 'Invalid adjustment operation' using errcode = '22023';
 end if;
 -- Numeric avoids implicit fractional-to-integer rounding at the RPC boundary.
 -- NaN and positive Infinity compare above this bound; negative Infinity below 0.
 if quantity is null or quantity < 0 or quantity > 2147483647 or quantity <> trunc(quantity)
    or (operation <> 'SET_EXACT' and quantity = 0) then
  raise exception 'Use a valid whole quantity' using errcode = '22023';
 end if;
 clean_reason := btrim(reason);
 clean_note := nullif(btrim(internal_note), '');
 if clean_reason is null or clean_reason not in (
  'Physical count correction','Damage','Quality rejection','Lost item',
  'Administrative correction','Production count correction','Other'
 ) then
  raise exception 'An approved adjustment reason is required' using errcode = '22023';
 end if;
 if length(clean_note) > 2000 then
  raise exception 'Internal note exceeds 2000 characters' using errcode = '22023';
 end if;

 -- Match the lock order used by the existing allocation/editor workflows.
 select row_p.* into p from public.products row_p
 where row_p.id = product_id for update;
 if not found then raise exception 'Product unavailable' using errcode = '42501'; end if;
 if p.updated_at is distinct from expected_updated_at then
  raise exception 'Inventory was updated elsewhere' using errcode = 'PT409';
 end if;
 select row_v.* into v from public.product_variants row_v
 where row_v.id = variant_id and row_v.product_id = p.id for update;
 if not found then raise exception 'Variant does not belong to this product' using errcode = '22023'; end if;
 if p.status not in ('draft','active') or p.archived_at is not null or p.sold_out_at is not null then
  raise exception 'This production run is locked' using errcode = '22023';
 end if;
 -- There is no piece-level reservation mapping. Conservatively lock a variant
 -- with any order-item history rather than guessing which pieces are protected.
 if exists(select 1 from public.order_items oi where oi.variant_id = v.id or (oi.variant_id is null and oi.product_id = p.id)) then
  raise exception 'Variant with order history cannot be manually adjusted' using errcode = '22023';
 end if;
 perform u.id from public.inventory_units u where u.product_id = p.id
 order by u.piece_number for update;
 select count(*) into produced_count from public.inventory_units u where u.product_id = p.id;
 select count(*) into before_count from public.inventory_units u
 where u.variant_id = v.id and u.sold_at is null and u.withdrawn_at is null;
 if (select count(*) from public.inventory_units u where u.product_id = p.id and u.sold_at is not null)
    >= p.production_limit then
  raise exception 'Completed production runs cannot be adjusted' using errcode = '22023';
 end if;
 target_count := case operation
  when 'INCREASE' then before_count::numeric + quantity
  when 'DECREASE' then before_count::numeric - quantity
  else quantity end;
 if target_count < 0 then
  raise exception 'Decrease exceeds eligible physical stock' using errcode = '22023';
 end if;
 if target_count = before_count then
  raise exception 'Adjustment must change eligible physical stock' using errcode = '22023';
 end if;
 if target_count > before_count then
  if p.status <> 'draft' or not v.enabled then
   raise exception 'New pieces require a draft and enabled variant' using errcode = '22023';
  end if;
  if produced_count::numeric + target_count - before_count > p.production_limit then
   raise exception 'Increase exceeds historical production capacity' using errcode = '22023';
  end if;
 end if;
 change_count := (target_count - before_count)::integer;
 new_operation_id := gen_random_uuid();

 -- Store the server-computed target, then verify it against the actual result
 -- before commit. Any failure rolls back the parent, pieces and child events.
 insert into public.inventory_adjustment_operations
  (id, variant_id, actor_id, operation, reason, internal_note, before_quantity, after_quantity)
 values(new_operation_id, v.id, auth.uid(), operation, clean_reason, clean_note, before_count, target_count::integer);
 previous_operation := current_setting('percent.inventory_operation', true);
 perform set_config('percent.inventory_operation', new_operation_id::text, true);
 if change_count > 0 then
  insert into public.inventory_units(product_id, variant_id, piece_number)
  select p.id, v.id, serial from generate_series(1, p.production_limit) as serial
  where not exists(select 1 from public.inventory_units u where u.product_id = p.id and u.piece_number = serial)
  order by serial limit change_count;
  get diagnostics affected_count = row_count;
 else
  -- Highest piece numbers first; sold/withdrawn pieces are never selected.
  update public.inventory_units u set withdrawn_at = now()
  where u.id in (
   select candidate.id from public.inventory_units candidate
   where candidate.variant_id = v.id and candidate.sold_at is null and candidate.withdrawn_at is null
   order by candidate.piece_number desc limit (-change_count)
  );
  get diagnostics affected_count = row_count;
 end if;
 perform set_config('percent.inventory_operation', coalesce(previous_operation, ''), true);
 select count(*) into after_count from public.inventory_units u
 where u.variant_id = v.id and u.sold_at is null and u.withdrawn_at is null;
 select count(*) into event_count from public.inventory_adjustments a where a.operation_id = new_operation_id;
 if affected_count <> abs(change_count) or event_count <> abs(change_count) or after_count <> target_count then
  raise exception 'Adjustment could not be completed atomically' using errcode = '22023';
 end if;
 -- Existing timestamp trigger advances the version shared with Phase 3A/editor.
 update public.products set updated_at = now() where id = p.id returning * into p;
 return jsonb_build_object('operation_id',new_operation_id,'product_id',p.id,'variant_id',v.id,
  'operation',operation,'before_quantity',before_count,'after_quantity',after_count,
  'historical_produced',produced_count + greatest(change_count,0),
  'run_remaining',p.production_limit - produced_count - greatest(change_count,0),
  'updated_at',p.updated_at);
end;
$$;
revoke all on function public.adjust_variant_inventory(uuid,uuid,text,numeric,text,timestamptz,text)
 from public, anon, authenticated, service_role;
grant execute on function public.adjust_variant_inventory(uuid,uuid,text,numeric,text,timestamptz,text)
 to authenticated;

commit;

