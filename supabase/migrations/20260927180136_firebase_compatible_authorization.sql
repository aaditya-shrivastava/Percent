-- Firebase-compatible authorization for the Supabase Auth transition.
-- This migration preserves every Percent UUID and resolves all caller identity
-- through private.current_user_id().
begin;

-- Email is account data, not an identity key. Keep it on the private principal
-- so Firebase-only customers can check out and appear in Admin without joining
-- auth.users or linking accounts by email.
alter table private.percent_principals
  add column email text;

alter table private.percent_principals
  add constraint percent_principals_email_length
  check (email is null or char_length(email) <= 320) not valid;

update private.percent_principals as principal
set email = lower(nullif(btrim(auth_user.email), ''))
from auth.users as auth_user
where auth_user.id = principal.id
  and principal.email is distinct from lower(nullif(btrim(auth_user.email), ''));

alter table private.percent_principals
  validate constraint percent_principals_email_length;

revoke all on table private.percent_principals from public, anon, authenticated;

-- Patch the deployed function bodies without duplicating their unrelated,
-- previously verified business logic. Every target is signature-pinned and
-- must still contain auth.uid(), otherwise the migration fails closed.
do $migration$
declare
  target regprocedure;
  definition text;
  targets constant regprocedure[] := array[
    'private.record_unit()'::regprocedure,
    'public.adjust_variant_inventory(uuid,uuid,text,numeric,text,timestamptz,text)'::regprocedure,
    'public.admin_get_customer(uuid)'::regprocedure,
    'public.admin_list_customers(text,text,text,integer,integer)'::regprocedure,
    'public.allocate_product_run(uuid,jsonb,timestamptz)'::regprocedure,
    'public.create_checkout_order(jsonb,uuid,uuid)'::regprocedure,
    'public.get_website_editor()'::regprocedure,
    'public.get_website_page_editor(text)'::regprocedure,
    'public.publish_product(uuid,timestamptz)'::regprocedure,
    'public.save_address(jsonb)'::regprocedure,
    'public.save_blog_post(uuid,jsonb,timestamptz)'::regprocedure,
    'public.save_product_draft(jsonb,uuid,timestamptz)'::regprocedure,
    'public.save_website_content(jsonb,timestamptz)'::regprocedure,
    'public.save_website_page(text,jsonb,timestamptz)'::regprocedure,
    'public.set_product_review_visibility(uuid,boolean,timestamptz)'::regprocedure,
    'public.update_order_lifecycle(uuid,text,text,timestamptz,text,text)'::regprocedure
  ];
begin
  foreach target in array targets loop
    select pg_get_functiondef(target::oid) into definition;
    if position('auth.uid()' in definition) = 0 then
      raise exception 'Expected auth.uid() in %', target;
    end if;

    definition := replace(definition, 'auth.uid()', 'private.current_user_id()');

    if target = 'public.admin_get_customer(uuid)'::regprocedure
       or target = 'public.admin_list_customers(text,text,text,integer,integer)'::regprocedure then
      definition := replace(definition, 'u.email', 'principal.email');
      definition := replace(
        definition,
        'join auth.users u on u.id = p.id',
        'join private.percent_principals principal on principal.id = p.id'
      );
    end if;

    if target = 'public.create_checkout_order(jsonb,uuid,uuid)'::regprocedure then
      if position('An authenticated email is required' in definition) = 0 then
        raise exception 'Expected checkout email validation anchor in %', target;
      end if;
      definition := replace(
        definition,
        'select email into customer_email from auth.users where id = actor;',
        'select email into customer_email from private.percent_principals where id = actor;'
      );
      definition := replace(
        definition,
        'An authenticated email is required',
        'Add a verified contact email before checkout'
      );
    end if;

    if definition ~* 'auth[.]uid[(]' then
      raise exception 'Unresolved auth.uid() remains in %', target;
    end if;
    if (
      target = 'public.admin_get_customer(uuid)'::regprocedure
      or target = 'public.admin_list_customers(text,text,text,integer,integer)'::regprocedure
      or target = 'public.create_checkout_order(jsonb,uuid,uuid)'::regprocedure
    ) and definition ~* 'auth[.]users' then
      raise exception 'Unresolved auth.users dependency remains in %', target;
    end if;

    execute definition;
  end loop;
end
$migration$;

-- Keep Supabase-created principals and their trusted emails synchronized while
-- Supabase Auth remains enabled during the transition.
create or replace function private.bootstrap_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.percent_principals(id, email, created_at)
  values (
    new.id,
    lower(nullif(btrim(new.email), '')),
    coalesce(new.created_at, now())
  );
  insert into public.profiles(id) values (new.id);
  insert into private.user_roles(user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.bootstrap_customer()
  from public, anon, authenticated, service_role;

create function private.sync_supabase_principal_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.percent_principals
  set email = lower(nullif(btrim(new.email), ''))
  where id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_supabase_principal_email()
  from public, anon, authenticated, service_role;

create trigger percent_principal_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.sync_supabase_principal_email();

-- Firebase provisioning derives the external subject from the verified JWT.
-- Only a verified Google email is eligible to initialize contact email. A
-- password-provider email may be an internal username alias and is ignored.
-- Email is never used for linking and no role is accepted from the caller.
create or replace function public.provision_my_percent_identity()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  firebase_issuer constant text := 'https://securetoken.google.com/percent-63d3e';
  firebase_audience constant text := 'percent-63d3e';
  firebase_subject text := claims ->> 'sub';
  trusted_email text := case
    when claims #>> '{firebase,sign_in_provider}' = 'google.com'
     and claims ->> 'email_verified' = 'true'
    then lower(nullif(btrim(claims ->> 'email'), ''))
    else null
  end;
  existing_id uuid;
  new_id uuid;
begin
  if claims is null
     or claims ->> 'iss' is distinct from firebase_issuer
     or claims ->> 'aud' is distinct from firebase_audience
     or claims ->> 'role' is distinct from 'authenticated'
     or firebase_subject is null
     or firebase_subject = ''
     or length(firebase_subject) > 128
     or (trusted_email is not null and char_length(trusted_email) > 320) then
    raise exception 'Verified Percent Firebase authentication required'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(firebase_issuer || chr(31) || firebase_subject, 0)
  );

  select identity.percent_user_id
  into existing_id
  from private.external_identities as identity
  where identity.issuer = firebase_issuer
    and identity.external_subject = firebase_subject;

  if existing_id is not null then
    if not exists (
      select 1 from private.percent_principals as principal
      where principal.id = existing_id
    ) or not exists (
      select 1 from public.profiles as profile
      where profile.id = existing_id
    ) or not exists (
      select 1 from private.user_roles as role_record
      where role_record.user_id = existing_id
    ) then
      raise exception 'Firebase identity mapping is incomplete'
        using errcode = '23503';
    end if;
    if trusted_email is not null then
      update private.percent_principals
      set email = trusted_email
      where id = existing_id and email is null;
    end if;
    return existing_id;
  end if;

  new_id := gen_random_uuid();
  insert into private.percent_principals(id, email)
  values (new_id, trusted_email);
  insert into private.external_identities(
    provider, issuer, external_subject, percent_user_id
  ) values (
    'firebase', firebase_issuer, firebase_subject, new_id
  );
  insert into public.profiles(id) values (new_id);
  insert into private.user_roles(user_id, role) values (new_id, 'customer');

  return new_id;
exception
  when unique_violation then
    raise exception 'Firebase identity provisioning collision'
      using errcode = '23505';
end;
$$;

revoke all on function public.provision_my_percent_identity()
  from public, anon, authenticated, service_role;
grant execute on function public.provision_my_percent_identity() to authenticated;

-- Ownership policies retain their original commands and intent while mapping
-- both Supabase and Firebase JWTs to the internal Percent UUID.
drop policy read_own_role on private.user_roles;
create policy read_own_role on private.user_roles for select to authenticated
using (user_id = (select private.current_user_id()));

drop policy own_addresses on public.addresses;
create policy own_addresses on public.addresses for all to authenticated
using (user_id = (select private.current_user_id()))
with check (user_id = (select private.current_user_id()));

drop policy own_order_addresses on public.order_addresses;
create policy own_order_addresses on public.order_addresses for select to authenticated
using (exists (
  select 1 from public.orders as owned_order
  where owned_order.id = order_addresses.order_id
    and owned_order.user_id = (select private.current_user_id())
));

drop policy own_order_items on public.order_items;
create policy own_order_items on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders as owned_order
  where owned_order.id = order_items.order_id
    and owned_order.user_id = (select private.current_user_id())
));

drop policy own_orders on public.orders;
create policy own_orders on public.orders for select to authenticated
using (user_id = (select private.current_user_id()));

drop policy delete_pending_review on public.product_reviews;
create policy delete_pending_review on public.product_reviews for delete to authenticated
using (user_id = (select private.current_user_id()) and status = 'pending');

drop policy edit_pending_review on public.product_reviews;
create policy edit_pending_review on public.product_reviews for update to authenticated
using (user_id = (select private.current_user_id()) and status = 'pending')
with check (user_id = (select private.current_user_id()) and status = 'pending');

drop policy own_reviews on public.product_reviews;
create policy own_reviews on public.product_reviews for select to authenticated
using (user_id = (select private.current_user_id()));

drop policy submit_review on public.product_reviews;
create policy submit_review on public.product_reviews for insert to authenticated
with check (
  user_id = (select private.current_user_id())
  and status = 'pending'
  and exists (
    select 1 from public.products as review_product
    where review_product.id = product_reviews.product_id
      and review_product.is_visible
      and review_product.status in ('active', 'archived')
  )
);

drop policy edit_profile on public.profiles;
create policy edit_profile on public.profiles for update to authenticated
using (id = (select private.current_user_id()))
with check (id = (select private.current_user_id()));

drop policy own_profile on public.profiles;
create policy own_profile on public.profiles for select to authenticated
using (id = (select private.current_user_id()));

drop policy own_wishlist on public.wishlist_items;
create policy own_wishlist on public.wishlist_items for all to authenticated
using (user_id = (select private.current_user_id()))
with check (user_id = (select private.current_user_id()));

drop policy percent_review_delivery on storage.objects;
create policy percent_review_delivery on storage.objects for select to authenticated
using (
  bucket_id = 'percent-review-images'
  and exists (
    select 1
    from public.review_images as image
    join public.product_reviews as review on review.id = image.review_id
    where image.object_path = objects.name
      and (
        review.user_id = (select private.current_user_id())
        or review.status = 'approved'
      )
  )
);

-- Fail the transaction if any application authorization path was missed.
do $verification$
declare
  remaining_functions text[];
  remaining_policies text[];
begin
  select array_agg(format('%I.%I(%s)', n.nspname, p.proname,
                         pg_get_function_identity_arguments(p.oid)))
  into remaining_functions
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private', 'storage')
    and p.prokind = 'f'
    and pg_get_functiondef(p.oid) ~* 'auth[.]uid[(]|auth[.]users';

  if remaining_functions is not null then
    raise exception 'Legacy caller identity remains in functions: %', remaining_functions;
  end if;

  select array_agg(format('%I.%I.%I', schemaname, tablename, policyname))
  into remaining_policies
  from pg_policies
  where schemaname in ('public', 'private', 'storage')
    and (coalesce(qual, '') || coalesce(with_check, '')) ~* 'auth[.]uid[(]';

  if remaining_policies is not null then
    raise exception 'Legacy caller identity remains in policies: %', remaining_policies;
  end if;

  if not exists (
    select 1
    from private.user_roles as role_record
    join private.percent_principals as principal on principal.id = role_record.user_id
    where role_record.role = 'super_admin'
  ) then
    raise exception 'Existing super_admin principal is not preserved';
  end if;

  if to_regprocedure('private.current_user_id()') is null
     or to_regprocedure('public.provision_my_percent_identity()') is null
     or not exists (
       select 1 from pg_trigger
       where tgrelid = 'auth.users'::regclass
         and tgname = 'percent_customer_created'
         and not tgisinternal
     ) then
    raise exception 'Required transition identity objects are missing';
  end if;
end
$verification$;

commit;
