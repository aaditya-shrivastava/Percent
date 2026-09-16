-- Safe aggregate API: physical-unit identities stay private. The definer helper
-- deliberately serves public counts, and independently checks publication.
grant usage on schema private to anon;
create function private.catalog_stock() returns table(product_id uuid, variant_id uuid, sold_quantity bigint, available_quantity bigint)
language sql stable security definer set search_path='' as $$
 select p.id,v.id,count(u.id) filter(where u.sold_at is not null),
 case when p.status='active' and p.is_shop_available and v.enabled then count(u.id) filter(where u.sold_at is null and u.withdrawn_at is null) else 0 end
 from public.products p join public.product_variants v on v.product_id=p.id
 left join public.inventory_units u on u.variant_id=v.id
 where p.is_visible and p.status in ('active','archived')
 group by p.id,v.id
$$;
revoke all on function private.catalog_stock() from public;
grant execute on function private.catalog_stock() to anon,authenticated;
create function public.catalog_stock() returns table(product_id uuid,variant_id uuid,sold_quantity bigint,available_quantity bigint)
language sql stable security invoker set search_path='' as $$ select * from private.catalog_stock() $$;
revoke all on function public.catalog_stock() from public;
grant execute on function public.catalog_stock() to anon,authenticated;

-- Serialize address mutations per customer, including concurrent default switches.
create function public.save_address(address jsonb) returns public.addresses
language plpgsql security invoker set search_path='' as $$
declare uid uuid := auth.uid(); result public.addresses; aid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform 1 from public.profiles where id=uid for update;
 aid := coalesce(nullif(address->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from public.addresses where id=aid) and not exists(select 1 from public.addresses where id=aid and user_id=uid) then raise exception 'Address unavailable'; end if;
 if coalesce((address->>'is_default')::boolean,false) then update public.addresses set is_default=false where user_id=uid and is_default; end if;
 insert into public.addresses(id,user_id,label,is_default,full_name,phone,address_line1,address_line2,city,state,pin_code,country)
 values(aid,uid,coalesce(address->>'label','Home'),coalesce((address->>'is_default')::boolean,false),address->>'full_name',address->>'phone',address->>'address_line1',coalesce(address->>'address_line2',''),address->>'city',address->>'state',address->>'pin_code','IN')
 on conflict(id) do update set label=excluded.label,is_default=excluded.is_default,full_name=excluded.full_name,phone=excluded.phone,address_line1=excluded.address_line1,address_line2=excluded.address_line2,city=excluded.city,state=excluded.state,pin_code=excluded.pin_code
 returning * into result;
 return result;
end $$;
revoke all on function public.save_address(jsonb) from public;
grant execute on function public.save_address(jsonb) to authenticated;

-- Review files are uploaded only by the verified Edge Function after content
-- validation. Signed delivery checks review visibility through this policy.
create policy percent_review_delivery on storage.objects for select to authenticated
using(bucket_id='percent-review-images' and exists(select 1 from public.review_images i join public.product_reviews r on r.id=i.review_id where i.object_path=name and (r.user_id=(select auth.uid()) or r.status='approved')));
