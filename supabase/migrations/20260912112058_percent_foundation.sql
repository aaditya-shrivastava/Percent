-- Percent Phase 1 migration. Tested locally; never applied to a hosted project.
-- No project is linked. Verify Percent identity before any eventual remote deployment.
-- Deliberately refuses an existing application database, in addition to the
-- required external project-name/ref check. SQL cannot verify a dashboard name.
do $$ begin
 if exists(select 1 from pg_tables where schemaname='public') then
  raise exception 'Percent foundation requires a fresh application schema; STOP and verify target';
 end if;
end $$;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Percent Customer' check (length(display_name) between 1 and 120),
 first_name text, last_name text, phone text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.user_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'customer' check (role in ('customer','admin','super_admin')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.user_roles enable row level security;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from private.user_roles where user_id = auth.uid() and role in ('admin','super_admin'));
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;
create function private.bootstrap_customer() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id) values(new.id);
 insert into private.user_roles(user_id) values(new.id);
 return new;
end $$;
revoke all on function private.bootstrap_customer() from public;
create trigger percent_customer_created after insert on auth.users for each row execute function private.bootstrap_customer();

create table public.categories (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
 active boolean not null default true, display_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.colours (
 id uuid primary key default gen_random_uuid(), slug text not null unique, label text not null,
 swatch_value text not null check(swatch_value ~ '^#[0-9A-Fa-f]{6}$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tags (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, group_name text not null,
 is_filterable boolean not null default true, active boolean not null default true, display_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key default gen_random_uuid(), legacy_id text unique,
 design_code text not null unique, slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null, short_description text not null default '', full_description text not null default '',
 category_id uuid references public.categories(id) on delete restrict,
 fit_type text not null check(fit_type in ('standard','oversized')),
 status text not null default 'draft' check(status in ('draft','active','archived')),
 is_visible boolean not null default false, is_shop_available boolean not null default true,
 is_limited boolean not null default true, total_produced integer not null default 100 check(total_produced > 0),
 price_paise integer not null check(price_paise >= 0), compare_at_price_paise integer check(compare_at_price_paise >= price_paise),
 currency text not null default 'INR' check(currency = 'INR'),
 material text, style text, care_instructions text, shipping_and_returns text,
 collaborator_name text, collaboration_title text, collaboration_description text, collaborator_image_url text,
 featured boolean not null default false, display_order integer not null default 0, launch_at timestamptz,
 sold_out_at timestamptz, archived_at timestamptz, archive_number text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(not is_limited or total_produced = 100),
 check((status = 'archived') = (archived_at is not null)),
 check(sold_out_at is null or status = 'archived')
);
create table public.product_tags (
 product_id uuid not null references public.products(id) on delete cascade,
 tag_id uuid not null references public.tags(id) on delete restrict,
 created_at timestamptz not null default now(), primary key(product_id,tag_id)
);
create table public.product_variants (
 id uuid primary key default gen_random_uuid(), legacy_id text unique,
 product_id uuid not null references public.products(id) on delete restrict,
 colour_id uuid not null references public.colours(id) on delete restrict,
 size text not null check(length(size) between 1 and 20), sku text not null unique,
 price_paise integer not null check(price_paise >= 0), compare_at_price_paise integer check(compare_at_price_paise >= price_paise),
 enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(product_id,colour_id,size), unique(id,product_id)
);
create table public.product_images (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 url text not null, alt text not null, width integer not null check(width>0), height integer not null check(height>0),
 role text not null check(role in ('primary','hover','front','back','model','detail','gallery')),
 sort_order integer not null check(sort_order>=0), created_at timestamptz not null default now(),
 unique(product_id,sort_order), unique(id,product_id)
);
create table public.variant_images (
 variant_id uuid not null, product_id uuid not null, image_id uuid not null, sort_order integer not null check(sort_order>=0),
 primary key(variant_id,image_id), unique(variant_id,sort_order),
 foreign key(variant_id,product_id) references public.product_variants(id,product_id) on delete cascade,
 foreign key(image_id,product_id) references public.product_images(id,product_id) on delete cascade
);
-- One row per physical piece: serials cannot be recreated after a sale or withdrawal.
-- No checkout/sale RPC or payment reservation workflow is exposed in Phase 1.
create table public.inventory_units (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict,
 variant_id uuid not null, piece_number integer not null check(piece_number > 0),
 sold_at timestamptz, withdrawn_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(variant_id,product_id) references public.product_variants(id,product_id) on delete restrict,
 unique(product_id,piece_number), check(sold_at is null or withdrawn_at is null)
);
create table public.inventory_adjustments (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.inventory_units(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null, reason text not null,
 old_state jsonb, new_state jsonb not null, created_at timestamptz not null default now()
);
create table public.addresses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 label text not null default 'Home', is_default boolean not null default false,
 full_name text not null, phone text not null, address_line1 text not null, address_line2 text not null default '',
 city text not null, state text not null, pin_code text not null check(pin_code ~ '^[1-9][0-9]{5}$'), country text not null default 'IN' check(country='IN'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_default_address on public.addresses(user_id) where is_default;
-- One wishlist per customer; no list metadata exists in the frontend.
create table public.wishlist_items (
 user_id uuid not null references public.profiles(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,product_id)
);
create table public.product_reviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete restrict,
 rating smallint not null check(rating between 1 and 5), title text check(length(title)<=100),
 body text not null check(length(btrim(body)) between 1 and 1200), customer_name text not null check(length(customer_name) between 1 and 120),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,product_id)
);
create table public.review_images (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references public.product_reviews(id) on delete cascade,
 slot smallint not null check(slot between 1 and 3), object_path text not null unique, alt text not null default '',
 created_at timestamptz not null default now(), unique(review_id,slot)
);
create table public.coupons (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code = upper(code) and length(code) between 1 and 40),
 kind text not null check(kind in ('fixed','percentage')), amount_paise integer, percent_bps integer,
 minimum_subtotal_paise integer not null default 0 check(minimum_subtotal_paise >= 0),
 starts_at timestamptz, ends_at timestamptz, active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((kind='fixed' and amount_paise is not null and amount_paise>0 and percent_bps is null) or (kind='percentage' and percent_bps is not null and percent_bps between 1 and 10000 and amount_paise is null)),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), order_reference text not null unique,
 user_id uuid references public.profiles(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled','completed')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending','paid','failed','partially_refunded','refunded')),
 fulfillment_status text not null default 'unfulfilled' check(fulfillment_status in ('unfulfilled','processing','shipped','out_for_delivery','delivered','cancelled','returned')),
 currency text not null default 'INR' check(currency='INR'),
 subtotal_paise bigint not null check(subtotal_paise>=0), discount_paise bigint not null default 0 check(discount_paise>=0),
 shipping_paise bigint not null default 0 check(shipping_paise>=0), tax_paise bigint not null default 0 check(tax_paise>=0),
 total_paise bigint not null check(total_paise>=0), coupon_code_snapshot text,
 payment_provider text, payment_reference text, shipping_provider text, tracking_number text,
 estimated_delivery date, delivered_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(discount_paise<=subtotal_paise), check(total_paise = subtotal_paise-discount_paise+shipping_paise+tax_paise)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
 product_id uuid references public.products(id) on delete restrict, variant_id uuid references public.product_variants(id) on delete restrict,
 product_name text not null, product_slug text not null, sku text not null, size text not null, colour text not null, image_url text,
 quantity integer not null check(quantity>0), unit_price_paise integer not null check(unit_price_paise>=0),
 line_total_paise bigint generated always as (quantity::bigint * unit_price_paise) stored,
 created_at timestamptz not null default now(),
 foreign key(variant_id,product_id) references public.product_variants(id,product_id) on delete restrict,
 check(variant_id is null or product_id is not null)
);
create table public.order_addresses (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
 kind text not null default 'shipping' check(kind in ('shipping','billing')),
 full_name text not null, email text not null, phone text not null, address_line1 text not null, address_line2 text not null default '',
 city text not null, state text not null, pin_code text not null, country text not null,
 created_at timestamptz not null default now(), unique(order_id,kind)
);
create table public.blog_posts (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), title text not null,
 excerpt text not null, introduction text not null, category text not null check(category in ('Brand','Design','Style','Process','Community')),
 author text not null, published_at timestamptz, status text not null default 'draft' check(status in ('draft','published','archived')),
 featured boolean not null default false, pull_quote text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'published' or published_at is not null)
);
create table public.blog_sections (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.blog_posts(id) on delete cascade,
 heading text not null, paragraphs jsonb not null check(jsonb_typeof(paragraphs)='array'), sort_order integer not null check(sort_order>=0),
 unique(post_id,sort_order)
);
create table public.blog_images (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.blog_posts(id) on delete cascade,
 role text not null check(role in ('primary','secondary')), url text not null, alt text not null,
 width integer not null check(width>0), height integer not null check(height>0), unique(post_id,role)
);
create table private.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
 table_name text not null, operation text not null, row_id text, created_at timestamptz not null default now()
);
alter table private.audit_logs enable row level security;

create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create function private.keep_design_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Design identities are permanent; archive instead'; end if;
 if (new.design_code,new.slug,new.is_limited,new.total_produced) is distinct from (old.design_code,old.slug,old.is_limited,old.total_produced) then
   raise exception 'Design identity and production run are immutable';
 end if;
 if old.status='archived' and (new.status <> 'archived' or new.archived_at is distinct from old.archived_at) then raise exception 'Archived designs cannot be reopened'; end if;
 if old.sold_out_at is not null and new.sold_out_at is distinct from old.sold_out_at then raise exception 'Sold-out state is permanent'; end if;
 return new;
end $$;
create trigger keep_design_identity before update or delete on public.products for each row execute function private.keep_design_identity();
create function private.guard_unit() returns trigger language plpgsql set search_path='' as $$
declare p public.products;
begin
 if TG_OP='DELETE' then raise exception 'Physical units cannot be deleted; withdraw instead'; end if;
 select * into p from public.products where id=new.product_id for update;
 if new.piece_number>p.total_produced then raise exception 'Piece number exceeds production run'; end if;
 if TG_OP='INSERT' and p.status<>'draft' then raise exception 'Units can only be allocated while a design is draft'; end if;
 if TG_OP='UPDATE' then
  if (new.id,new.product_id,new.piece_number) is distinct from (old.id,old.product_id,old.piece_number) then raise exception 'Unit identity is immutable'; end if;
  if old.sold_at is not null or old.withdrawn_at is not null then raise exception 'Sold or withdrawn units cannot be reused'; end if;
  if p.status='archived' then raise exception 'Archived inventory cannot change'; end if;
 end if;
 return new;
end $$;
create trigger guard_unit before insert or update or delete on public.inventory_units for each row execute function private.guard_unit();
create function private.record_unit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.inventory_adjustments(unit_id,actor_id,reason,old_state,new_state)
 values(new.id,auth.uid(),coalesce(nullif(current_setting('percent.inventory_reason',true),''),'Foundation inventory change'),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 if new.sold_at is not null and (select count(*) from public.inventory_units where product_id=new.product_id and sold_at is not null) = (select total_produced from public.products where id=new.product_id) then
  update public.products set status='archived',archived_at=coalesce(archived_at,now()),sold_out_at=coalesce(sold_out_at,now()) where id=new.product_id;
 end if;
 return new;
end $$;
revoke all on function private.record_unit() from public;
create trigger record_unit after insert or update on public.inventory_units for each row execute function private.record_unit();
create function private.check_run_complete() returns trigger language plpgsql set search_path='' as $$
declare p public.products;
begin
 select * into p from public.products where id=new.id;
 if p.status<>'draft' and (select count(*) from public.inventory_units where product_id=p.id)<>p.total_produced then raise exception 'Allocate the complete production run before activation/archive'; end if;
 if p.sold_out_at is not null and (select count(*) from public.inventory_units where product_id=p.id and sold_at is not null)<>p.total_produced then raise exception 'Sold-out requires every piece to have sold'; end if;
 return null;
end $$;
create constraint trigger complete_production_run after insert or update on public.products deferrable initially deferred for each row execute function private.check_run_complete();
create function private.immutable_snapshot() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Historical order snapshots are immutable'; end $$;
create trigger immutable_order_items before update or delete on public.order_items for each row execute function private.immutable_snapshot();
create trigger immutable_order_addresses before update or delete on public.order_addresses for each row execute function private.immutable_snapshot();
create trigger immutable_inventory_log before update or delete on public.inventory_adjustments for each row execute function private.immutable_snapshot();
create trigger immutable_audit_log before update or delete on private.audit_logs for each row execute function private.immutable_snapshot();
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.audit_logs(actor_id,table_name,operation,row_id) values(auth.uid(),TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,TG_OP,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'user_id',to_jsonb(old)->>'user_id'));
 return null;
end $$;
revoke all on function private.audit_change() from public;

-- RLS and explicit grants: no ambient Supabase defaults are relied upon.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at') then
   execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
  end if;
 end loop;
 foreach t in array array['products','product_variants','coupons','orders','product_reviews'] loop
  execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
create trigger audit_role after insert or update or delete on private.user_roles for each row execute function private.audit_change();

grant select on public.products,public.product_variants,public.product_images,public.variant_images,public.categories,public.colours,public.tags,public.product_tags,public.blog_posts,public.blog_sections,public.blog_images,public.product_reviews,public.review_images to anon,authenticated;
create policy public_products on public.products for select to anon,authenticated using(is_visible and status in ('active','archived'));
create policy public_categories on public.categories for select to anon,authenticated using(active);
create policy public_colours on public.colours for select to anon,authenticated using(true);
create policy public_tags on public.tags for select to anon,authenticated using(active);
do $$ declare t text; begin
 foreach t in array array['product_variants','product_images','variant_images','product_tags'] loop
  execute format('create policy public_product_children on public.%I for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.is_visible and p.status in (''active'',''archived'')))',t);
 end loop;
end $$;
create policy published_blogs on public.blog_posts for select to anon,authenticated using(status='published' and published_at<=now());
create policy published_sections on public.blog_sections for select to anon,authenticated using(exists(select 1 from public.blog_posts p where p.id=post_id and p.status='published' and p.published_at<=now()));
create policy published_images on public.blog_images for select to anon,authenticated using(exists(select 1 from public.blog_posts p where p.id=post_id and p.status='published' and p.published_at<=now()));
grant select on public.profiles,public.addresses,public.wishlist_items,public.orders,public.order_items,public.order_addresses to authenticated;
grant update(display_name,first_name,last_name,phone) on public.profiles to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy edit_profile on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant insert,update,delete on public.addresses to authenticated;
create policy own_addresses on public.addresses for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant insert,delete on public.wishlist_items to authenticated;
create policy own_wishlist on public.wishlist_items for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_orders on public.orders for select to authenticated using(user_id=(select auth.uid()));
create policy own_order_items on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));
create policy own_order_addresses on public.order_addresses for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));
create policy public_reviews on public.product_reviews for select to anon,authenticated using(status='approved' and exists(select 1 from public.products p where p.id=product_id and p.is_visible and p.status in ('active','archived')));
create policy own_reviews on public.product_reviews for select to authenticated using(user_id=(select auth.uid()));
grant insert(user_id,product_id,rating,title,body,customer_name),update(rating,title,body,customer_name),delete on public.product_reviews to authenticated;
create policy submit_review on public.product_reviews for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and exists(select 1 from public.products p where p.id=product_id and p.is_visible and p.status in ('active','archived')));
create policy edit_pending_review on public.product_reviews for update to authenticated using(user_id=(select auth.uid()) and status='pending') with check(user_id=(select auth.uid()) and status='pending');
create policy delete_pending_review on public.product_reviews for delete to authenticated using(user_id=(select auth.uid()) and status='pending');
-- Review image writes remain server-only until uploads and moderation are integrated.
create policy visible_review_images on public.review_images for select to anon,authenticated using(exists(select 1 from public.product_reviews r where r.id=review_id));

-- Admin operational access uses protected table roles, never user metadata.
-- Role assignment, inventory, orders and immutable audit trails remain server-only.
do $$ declare t text; begin
 foreach t in array array['products','product_variants','product_images','variant_images','categories','colours','tags','product_tags','blog_posts','blog_sections','blog_images','coupons'] loop
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy admin_manage on public.%I for all to authenticated using((select private.is_admin())) with check((select private.is_admin()))',t);
 end loop;
 foreach t in array array['profiles','addresses','orders','order_items','order_addresses','product_reviews','review_images','inventory_units','inventory_adjustments'] loop
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy admin_read on public.%I for select to authenticated using((select private.is_admin()))',t);
 end loop;
end $$;
grant select on private.user_roles,private.audit_logs to authenticated;
create policy read_own_role on private.user_roles for select to authenticated using(user_id=(select auth.uid()));
create policy admin_audit on private.audit_logs for select to authenticated using((select private.is_admin()));
grant all on private.user_roles,private.audit_logs to service_role;

-- Private physical unit data; expose only aggregate counts via a server adapter later.
-- This view is deliberately not granted to anon; inventory read API is Phase 2.
create view public.inventory_summary with(security_invoker=true) as
select p.id product_id,p.total_produced,count(u.id)::integer allocated_pieces,
 count(u.id) filter(where u.sold_at is not null)::integer sold_pieces,
 count(u.id) filter(where u.sold_at is null and u.withdrawn_at is null)::integer remaining_pieces,
 count(u.id) filter(where u.withdrawn_at is not null)::integer withdrawn_pieces
from public.products p left join public.inventory_units u on u.product_id=p.id group by p.id;
revoke all on public.inventory_summary from anon,authenticated;
grant select on public.inventory_summary to service_role;
create view public.variant_inventory_summary with(security_invoker=true) as
select v.id variant_id,v.product_id,count(u.id)::integer allocated_pieces,
 count(u.id) filter(where u.sold_at is not null)::integer sold_pieces,
 count(u.id) filter(where u.sold_at is null and u.withdrawn_at is null)::integer remaining_pieces,
 count(u.id) filter(where u.withdrawn_at is not null)::integer withdrawn_pieces
from public.product_variants v left join public.inventory_units u on u.variant_id=v.id group by v.id;
revoke all on public.variant_inventory_summary from anon,authenticated;
grant select on public.variant_inventory_summary to service_role;

-- Index all referencing FK prefixes, including policy ownership lookups.
do $$ declare r record; begin
 for r in select c.conrelid::regclass tab,c.conname,array_to_string(array_agg(quote_ident(a.attname) order by k.ord),',') cols
 from pg_constraint c cross join lateral unnest(c.conkey) with ordinality k(attnum,ord)
 join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
 where c.contype='f' and c.connamespace in ('public'::regnamespace,'private'::regnamespace)
 group by c.conrelid,c.conname loop
  execute format('create index %I on %s (%s)',left(r.conname,55)||'_idx',r.tab,r.cols);
 end loop;
end $$;
create index public_product_listing on public.products(status,display_order) where is_visible;
create index public_review_listing on public.product_reviews(product_id,created_at desc) where status='approved';
create index published_blog_listing on public.blog_posts(published_at desc) where status='published';
create index customer_order_history on public.orders(user_id,created_at desc);

-- Only private buckets initially. Existing Unsplash URLs stay external references.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('percent-product-images','percent-product-images',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('percent-review-images','percent-review-images',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('percent-blog-images','percent-blog-images',false,10485760,array['image/jpeg','image/png','image/webp']);
-- No client Storage write/read policies in Phase 1. Signed delivery and moderation
-- must be implemented and verified before enabling customer uploads in Phase 2.
