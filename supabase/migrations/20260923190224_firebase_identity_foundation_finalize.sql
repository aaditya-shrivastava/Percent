-- MANUAL EXECUTION ONLY.
-- Run only in Percent (gijyjdeohvdrnvqfqdha).
-- Finalizes and validates the partially applied Firebase identity foundation.
-- It does not relink identities, change roles, or rewrite customer/history data.
begin;

do $$
declare
  principals regclass := to_regclass('private.percent_principals');
  identities regclass := to_regclass('private.external_identities');
begin
  if principals is null then
    raise exception 'Missing private.percent_principals; stop for manual review';
  end if;
  if identities is null then
    raise exception 'Missing private.external_identities; stop for manual review';
  end if;

  if not exists (
    select 1 from pg_class as table_record
    where table_record.oid = principals and table_record.relrowsecurity
  ) or not exists (
    select 1 from pg_class as table_record
    where table_record.oid = identities and table_record.relrowsecurity
  ) then
    raise exception 'Identity tables must have row level security enabled';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_record
    where constraint_record.conrelid = identities
      and constraint_record.conname = 'external_identities_issuer_subject_key'
      and constraint_record.contype = 'u'
      and constraint_record.convalidated
  ) then
    raise exception 'Missing validated external identity issuer/subject uniqueness';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_record
    where constraint_record.conrelid = identities
      and constraint_record.conname = 'external_identities_percent_user_id_fkey'
      and constraint_record.contype = 'f'
      and constraint_record.confrelid = principals
      and constraint_record.confdeltype = 'c'
      and constraint_record.convalidated
  ) then
    raise exception 'External identity principal foreign key is missing or invalid';
  end if;
end;
$$;

-- Safe corrective backfill only: preserve existing UUIDs and add a principal
-- solely when an existing Supabase Auth user is unexpectedly missing one.
insert into private.percent_principals(id, created_at)
select auth_user.id, coalesce(auth_user.created_at, now())
from auth.users as auth_user
on conflict (id) do nothing;

create index if not exists external_identities_percent_user_idx
  on private.external_identities(percent_user_id);

-- Reassert the intended private-table privilege boundary. These statements are
-- idempotent and do not touch table rows.
alter table private.percent_principals enable row level security;
alter table private.external_identities enable row level security;
revoke all on private.percent_principals, private.external_identities
  from public, anon, authenticated;
grant all on private.percent_principals, private.external_identities to service_role;

do $$
declare
  expected record;
  constraint_oid oid;
  constraint_valid boolean;
begin
  for expected in
    select * from (values
      ('public',  'profiles',                        'profiles_id_fkey',                        'id',      'c'),
      ('private', 'user_roles',                     'user_roles_user_id_fkey',                 'user_id', 'c'),
      ('private', 'audit_logs',                     'audit_logs_actor_id_fkey',                'actor_id','n'),
      ('public',  'inventory_adjustments',          'inventory_adjustments_actor_id_fkey',     'actor_id','n'),
      ('public',  'inventory_adjustment_operations','inventory_adjustment_operations_actor_id_fkey','actor_id','r'),
      ('public',  'order_lifecycle_history',        'order_lifecycle_history_actor_id_fkey',   'actor_id','r'),
      ('private', 'review_moderation_history',      'review_moderation_history_actor_id_fkey', 'actor_id','n')
    ) as required_fk(source_schema, source_table, constraint_name, source_column, delete_code)
  loop
    select foreign_key.oid, foreign_key.convalidated
    into constraint_oid, constraint_valid
    from pg_constraint as foreign_key
    join pg_class as source_relation on source_relation.oid = foreign_key.conrelid
    join pg_namespace as source_namespace on source_namespace.oid = source_relation.relnamespace
    join pg_class as target_relation on target_relation.oid = foreign_key.confrelid
    join pg_namespace as target_namespace on target_namespace.oid = target_relation.relnamespace
    join pg_attribute as source_attribute
      on source_attribute.attrelid = source_relation.oid
     and source_attribute.attnum = foreign_key.conkey[1]
    join pg_attribute as target_attribute
      on target_attribute.attrelid = target_relation.oid
     and target_attribute.attnum = foreign_key.confkey[1]
    where foreign_key.contype = 'f'
      and foreign_key.conname = expected.constraint_name
      and source_namespace.nspname = expected.source_schema
      and source_relation.relname = expected.source_table
      and source_attribute.attname = expected.source_column
      and cardinality(foreign_key.conkey) = 1
      and target_namespace.nspname = 'private'
      and target_relation.relname = 'percent_principals'
      and target_attribute.attname = 'id'
      and foreign_key.confdeltype = expected.delete_code;

    if constraint_oid is null then
      raise exception 'Required Percent principal foreign key is missing or incorrect: %', expected.constraint_name;
    end if;

    if not constraint_valid then
      execute format(
        'alter table %I.%I validate constraint %I',
        expected.source_schema,
        expected.source_table,
        expected.constraint_name
      );
    end if;

    constraint_oid := null;
    constraint_valid := null;
  end loop;
end;
$$;

do $$
declare
  current_user_function oid := to_regprocedure('private.current_user_id()');
  provision_function oid := to_regprocedure('public.provision_my_percent_identity()');
  current_definition text;
  provision_definition text;
begin
  if current_user_function is null then
    raise exception 'Missing private.current_user_id()';
  end if;
  if provision_function is null then
    raise exception 'Missing public.provision_my_percent_identity()';
  end if;

  select pg_get_functiondef(current_user_function)
  into current_definition;
  select pg_get_functiondef(provision_function)
  into provision_definition;

  if not exists (
    select 1 from pg_proc as function_record
    where function_record.oid = current_user_function
      and function_record.prorettype = 'uuid'::regtype
      and function_record.prosecdef
      and function_record.provolatile = 's'
      and 'search_path=""' = any(function_record.proconfig)
  ) or current_definition not like '%https://securetoken.google.com/percent-63d3e%'
     or current_definition not like '%https://gijyjdeohvdrnvqfqdha.supabase.co/auth/v1%'
     or current_definition not like '%private.external_identities%' then
    raise exception 'private.current_user_id() does not match the approved identity resolver';
  end if;

  if not exists (
    select 1 from pg_proc as function_record
    where function_record.oid = provision_function
      and function_record.prorettype = 'uuid'::regtype
      and function_record.prosecdef
      and function_record.provolatile = 'v'
      and function_record.pronargs = 0
      and 'search_path=""' = any(function_record.proconfig)
  ) or provision_definition not like '%https://securetoken.google.com/percent-63d3e%'
     or provision_definition not like '%private.external_identities%'
     or provision_definition not like '%private.percent_principals%'
     or provision_definition not like '%''customer''%' then
    raise exception 'public.provision_my_percent_identity() does not match the approved provisioner';
  end if;
end;
$$;

-- Restore the exact callable surface even if the failed manual run stopped
-- between a REVOKE and GRANT statement.
revoke all on function private.current_user_id()
  from public, anon, authenticated, service_role;
grant execute on function private.current_user_id() to authenticated;

revoke all on function private.is_admin()
  from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to authenticated;

revoke all on function public.get_my_role()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_role() to authenticated;

revoke all on function public.provision_my_percent_identity()
  from public, anon, authenticated, service_role;
grant execute on function public.provision_my_percent_identity() to authenticated;

revoke all on function private.bootstrap_customer()
  from public, anon, authenticated, service_role;
revoke all on function private.audit_change()
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1 from auth.users as auth_user
    left join private.percent_principals as principal
      on principal.id = auth_user.id
    where principal.id is null
  ) then
    raise exception 'An existing Supabase Auth UUID is missing its Percent principal';
  end if;

  if exists (
    select 1 from public.profiles as profile
    left join private.percent_principals as principal
      on principal.id = profile.id
    where principal.id is null
  ) then
    raise exception 'A profile is missing its Percent principal';
  end if;

  if exists (
    select 1 from private.user_roles as role_record
    left join private.percent_principals as principal
      on principal.id = role_record.user_id
    where principal.id is null
  ) then
    raise exception 'A role is missing its Percent principal';
  end if;

  if not exists (
    select 1 from private.user_roles as role_record
    where role_record.role = 'super_admin'
  ) or exists (
    select 1
    from private.user_roles as role_record
    left join private.percent_principals as principal
      on principal.id = role_record.user_id
    left join public.profiles as profile
      on profile.id = role_record.user_id
    where role_record.role = 'super_admin'
      and (principal.id is null or profile.id is null)
  ) then
    raise exception 'Existing super_admin UUID or role is not preserved';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_record
    join pg_class as relation_record on relation_record.oid = trigger_record.tgrelid
    join pg_namespace as namespace_record on namespace_record.oid = relation_record.relnamespace
    where namespace_record.nspname = 'auth'
      and relation_record.relname = 'users'
      and trigger_record.tgname = 'percent_customer_created'
      and trigger_record.tgfoid = 'private.bootstrap_customer()'::regprocedure
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled <> 'D'
  ) then
    raise exception 'percent_customer_created trigger is missing, disabled, or misconfigured';
  end if;

  if has_table_privilege('anon', 'private.percent_principals', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'private.percent_principals', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'private.external_identities', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'private.external_identities', 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', 'private.percent_principals', 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', 'private.external_identities', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Identity table privileges are not correctly restricted';
  end if;

  if has_function_privilege('anon', 'private.current_user_id()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'private.current_user_id()', 'EXECUTE')
     or has_function_privilege('anon', 'public.provision_my_percent_identity()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.provision_my_percent_identity()', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_role()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_role()', 'EXECUTE') then
    raise exception 'Identity function privileges are not correctly restricted';
  end if;
end;
$$;

commit;
