-- MANUAL EXECUTION ONLY.
-- Run only in Percent (gijyjdeohvdrnvqfqdha) after reviewing the complete file.
-- This migration establishes an internal UUID identity root while retaining
-- Supabase Auth compatibility. It does not migrate users or enable Firebase in
-- the frontend, and it does not retire the auth.users creation trigger.
begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('private.user_roles') is null
     or to_regclass('auth.users') is null then
    raise exception 'Percent identity foundation prerequisites are missing';
  end if;
  if to_regclass('private.percent_principals') is not null
     or to_regclass('private.external_identities') is not null then
    raise exception 'Percent identity foundation already exists; stop and inspect migration state';
  end if;
end;
$$;

create table private.percent_principals (
  id uuid primary key,
  created_at timestamptz not null default now()
);

create table private.external_identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{0,31}$'),
  issuer text not null check (issuer = btrim(issuer) and length(issuer) between 1 and 500),
  external_subject text not null check (
    external_subject = btrim(external_subject)
    and length(external_subject) between 1 and 128
  ),
  percent_user_id uuid not null references private.percent_principals(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint external_identities_issuer_subject_key unique (issuer, external_subject)
);

create index external_identities_percent_user_idx
  on private.external_identities(percent_user_id);

alter table private.percent_principals enable row level security;
alter table private.external_identities enable row level security;
revoke all on private.percent_principals, private.external_identities
  from public, anon, authenticated;
grant all on private.percent_principals, private.external_identities to service_role;

-- Preserve every existing Supabase Auth UUID as the Percent UUID.
insert into private.percent_principals(id, created_at)
select u.id, coalesce(u.created_at, now())
from auth.users as u;

do $$
begin
  if exists (
    select 1 from auth.users as u
    left join private.percent_principals as p on p.id = u.id
    where p.id is null
  ) then
    raise exception 'Auth user principal backfill is incomplete';
  end if;
  if exists (
    select 1 from private.user_roles as r
    where r.role = 'super_admin'
      and not exists (
        select 1 from private.percent_principals as p where p.id = r.user_id
      )
  ) then
    raise exception 'Existing super_admin identity was not preserved';
  end if;
end;
$$;

-- Only these root identity foreign keys move. UUID values and downstream
-- profile-owned foreign keys remain unchanged.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id)
  references private.percent_principals(id) on delete cascade not valid;
alter table public.profiles validate constraint profiles_id_fkey;

alter table private.user_roles drop constraint user_roles_user_id_fkey;
alter table private.user_roles
  add constraint user_roles_user_id_fkey foreign key (user_id)
  references private.percent_principals(id) on delete cascade not valid;
alter table private.user_roles validate constraint user_roles_user_id_fkey;

alter table private.audit_logs drop constraint audit_logs_actor_id_fkey;
alter table private.audit_logs
  add constraint audit_logs_actor_id_fkey foreign key (actor_id)
  references private.percent_principals(id) on delete set null not valid;
alter table private.audit_logs validate constraint audit_logs_actor_id_fkey;

alter table public.inventory_adjustments drop constraint inventory_adjustments_actor_id_fkey;
alter table public.inventory_adjustments
  add constraint inventory_adjustments_actor_id_fkey foreign key (actor_id)
  references private.percent_principals(id) on delete set null not valid;
alter table public.inventory_adjustments validate constraint inventory_adjustments_actor_id_fkey;

alter table public.inventory_adjustment_operations drop constraint inventory_adjustment_operations_actor_id_fkey;
alter table public.inventory_adjustment_operations
  add constraint inventory_adjustment_operations_actor_id_fkey foreign key (actor_id)
  references private.percent_principals(id) on delete restrict not valid;
alter table public.inventory_adjustment_operations validate constraint inventory_adjustment_operations_actor_id_fkey;

alter table public.order_lifecycle_history drop constraint order_lifecycle_history_actor_id_fkey;
alter table public.order_lifecycle_history
  add constraint order_lifecycle_history_actor_id_fkey foreign key (actor_id)
  references private.percent_principals(id) on delete restrict not valid;
alter table public.order_lifecycle_history validate constraint order_lifecycle_history_actor_id_fkey;

alter table private.review_moderation_history drop constraint review_moderation_history_actor_id_fkey;
alter table private.review_moderation_history
  add constraint review_moderation_history_actor_id_fkey foreign key (actor_id)
  references private.percent_principals(id) on delete set null not valid;
alter table private.review_moderation_history validate constraint review_moderation_history_actor_id_fkey;

-- Resolve the authenticated JWT to the existing Percent UUID. Firebase sub is
-- deliberately kept as text. The Supabase branch is temporary cutover support.
create function private.current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  token_issuer text := claims ->> 'iss';
  token_audience text := claims ->> 'aud';
  token_subject text := claims ->> 'sub';
  resolved_id uuid;
begin
  if claims is null or token_subject is null or token_subject = '' then
    return null;
  end if;

  if token_issuer = 'https://securetoken.google.com/percent-63d3e'
     and token_audience = 'percent-63d3e'
     and claims ->> 'role' = 'authenticated' then
    select identity.percent_user_id
    into resolved_id
    from private.external_identities as identity
    where identity.provider = 'firebase'
      and identity.issuer = token_issuer
      and identity.external_subject = token_subject;
    return resolved_id;
  end if;

  if token_issuer = 'https://gijyjdeohvdrnvqfqdha.supabase.co/auth/v1'
     and token_audience = 'authenticated'
     and claims ->> 'role' = 'authenticated'
     and token_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select principal.id
    into resolved_id
    from private.percent_principals as principal
    where principal.id = token_subject::uuid;
    return resolved_id;
  end if;

  return null;
end;
$$;

revoke all on function private.current_user_id() from public, anon, authenticated, service_role;
grant execute on function private.current_user_id() to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles as role_record
    where role_record.user_id = private.current_user_id()
      and role_record.role in ('admin', 'super_admin')
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to authenticated;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role_record.role
  from private.user_roles as role_record
  where role_record.user_id = private.current_user_id();
$$;

revoke all on function public.get_my_role() from public, anon, authenticated, service_role;
grant execute on function public.get_my_role() to authenticated;

-- Keep the existing auth.users trigger operational throughout the transition.
create or replace function private.bootstrap_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.percent_principals(id, created_at)
  values (new.id, coalesce(new.created_at, now()));
  insert into public.profiles(id) values (new.id);
  insert into private.user_roles(user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.bootstrap_customer() from public, anon, authenticated, service_role;

-- The audit trigger runs during atomic Firebase provisioning. It must record
-- the mapped Percent UUID rather than attempt to cast Firebase sub to uuid.
create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_logs(actor_id, table_name, operation, row_id)
  values (
    private.current_user_id(),
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    TG_OP,
    coalesce(
      to_jsonb(new) ->> 'id',
      to_jsonb(old) ->> 'id',
      to_jsonb(new) ->> 'user_id',
      to_jsonb(old) ->> 'user_id'
    )
  );
  return null;
end;
$$;

revoke all on function private.audit_change() from public, anon, authenticated, service_role;

-- No parameters: issuer, audience, external identity and role are all derived
-- server-side. Existing accounts are never linked by email through this RPC.
create function public.provision_my_percent_identity()
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
  existing_id uuid;
  new_id uuid;
begin
  if claims is null
     or claims ->> 'iss' is distinct from firebase_issuer
     or claims ->> 'aud' is distinct from firebase_audience
     or claims ->> 'role' is distinct from 'authenticated'
     or firebase_subject is null
     or firebase_subject = ''
     or length(firebase_subject) > 128 then
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
    return existing_id;
  end if;

  new_id := gen_random_uuid();
  insert into private.percent_principals(id) values (new_id);
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

do $$
begin
  if exists (
    select 1 from public.profiles as profile
    where not exists (
      select 1 from private.percent_principals as principal
      where principal.id = profile.id
    )
  ) or exists (
    select 1 from private.user_roles as role_record
    where not exists (
      select 1 from private.percent_principals as principal
      where principal.id = role_record.user_id
    )
  ) then
    raise exception 'Percent identity root validation failed';
  end if;

  -- This migration never updates or deletes user_roles. Directly assert that
  -- the pre-existing super_admin remains attached to its preserved principal
  -- and profile, without relying on temporary session state.
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
    raise exception 'Existing super_admin UUID or role was not preserved';
  end if;
end;
$$;

commit;

-- Rollback note:
-- Repointing these constraints to auth.users is safe only while every principal
-- referenced by profiles/roles/history also exists in auth.users. Once a new
-- Firebase-only principal is provisioned, rollback must first preserve or
-- reconcile that account; never delete identity rows to force a rollback.
