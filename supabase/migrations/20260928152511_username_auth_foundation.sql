-- MANUAL EXECUTION ONLY.
-- Run only in Percent (gijyjdeohvdrnvqfqdha) after reviewing this file.
-- Step 9A adds the private username foundation. It does not alter Firebase
-- accounts, Firebase email addresses, Percent UUIDs, roles, or identities.
begin;

do $$
begin
  if to_regclass('private.percent_principals') is null
     or to_regclass('private.external_identities') is null
     or to_regclass('private.user_roles') is null
     or to_regclass('public.profiles') is null
     or to_regprocedure('private.current_user_id()') is null then
    raise exception 'Percent identity foundation prerequisites are missing';
  end if;

  if to_regclass('private.login_usernames') is not null
     or to_regclass('private.reserved_login_usernames') is not null
     or to_regprocedure('public.claim_username(text)') is not null
     or to_regprocedure('public.get_my_username()') is not null then
    raise exception 'Username foundation already exists; stop and inspect migration state';
  end if;

  if not exists (
    select 1
    from private.percent_principals as principal
    join public.profiles as profile on profile.id = principal.id
    join private.user_roles as role_record on role_record.user_id = principal.id
    where principal.id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and role_record.role = 'super_admin'
  ) or not exists (
    select 1
    from private.external_identities as identity
    where identity.percent_user_id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and identity.provider = 'firebase'
      and identity.issuer = 'https://securetoken.google.com/percent-63d3e'
      and identity.external_subject = 'rcxlqZhTkKhFHor0UignSMwQkSX2'
  ) then
    raise exception 'Expected Percent super_admin identity mapping is missing';
  end if;
end;
$$;

create table private.reserved_login_usernames (
  normalized_username text primary key,
  reason text not null default 'platform' check (
    reason = btrim(reason) and char_length(reason) between 1 and 80
  ),
  created_at timestamptz not null default now(),
  constraint reserved_login_usernames_canonical check (
    normalized_username = lower(normalized_username)
    and normalized_username ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
    and normalized_username !~ '[._][._]'
  )
);

insert into private.reserved_login_usernames(normalized_username)
values
  ('admin'),
  ('administrator'),
  ('api'),
  ('help'),
  ('moderator'),
  ('official'),
  ('percent'),
  ('root'),
  ('security'),
  ('staff'),
  ('support'),
  ('system'),
  ('www');

create table private.login_usernames (
  percent_user_id uuid primary key
    references private.percent_principals(id) on delete cascade,
  username text not null,
  normalized_username text not null,
  firebase_login_alias text not null default (
    'u_' || replace(gen_random_uuid()::text, '-', '') || '@login.percent.invalid'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint login_usernames_username_canonical check (
    username = normalized_username
    and normalized_username = lower(normalized_username)
  ),
  constraint login_usernames_username_format check (
    char_length(normalized_username) between 3 and 24
    and normalized_username ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
    and normalized_username !~ '[._][._]'
  ),
  constraint login_usernames_normalized_username_key unique (normalized_username),
  constraint login_usernames_firebase_login_alias_key unique (firebase_login_alias),
  constraint login_usernames_firebase_login_alias_format check (
    firebase_login_alias ~ '^u_[0-9a-f]{32}@login[.]percent[.]invalid$'
  )
);

alter table private.reserved_login_usernames enable row level security;
alter table private.login_usernames enable row level security;

revoke all on table
  private.reserved_login_usernames,
  private.login_usernames
from public, anon, authenticated;

grant all on table
  private.reserved_login_usernames,
  private.login_usernames
to service_role;

create function private.touch_login_username_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_login_username_updated_at()
  from public, anon, authenticated, service_role;

create trigger touch_login_username_updated_at
before update on private.login_usernames
for each row execute function private.touch_login_username_updated_at();

create function public.claim_username(p_username text)
returns table (
  username text,
  normalized_username text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  requested_username text;
  existing_username private.login_usernames%rowtype;
begin
  if actor is null then
    raise exception 'Authenticated Percent identity required'
      using errcode = '42501';
  end if;

  if p_username is null or p_username is distinct from btrim(p_username) then
    raise exception 'Username must be 3-24 lowercase ASCII letters, numbers, periods, or underscores'
      using errcode = '22023';
  end if;

  requested_username := lower(p_username);

  if char_length(requested_username) not between 3 and 24
     or requested_username !~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
     or requested_username ~ '[._][._]' then
    raise exception 'Username must be 3-24 lowercase ASCII letters, numbers, periods, or underscores'
      using errcode = '22023';
  end if;

  -- Serialize claims for both the caller and the canonical username. The
  -- caller can claim once; retries with the same canonical name are safe.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(requested_username, 1));

  select mapping.*
  into existing_username
  from private.login_usernames as mapping
  where mapping.percent_user_id = actor;

  if found then
    if existing_username.normalized_username is distinct from requested_username then
      raise exception 'A different username is already assigned to this account'
        using errcode = 'PT409';
    end if;

    return query
    select
      existing_username.username,
      existing_username.normalized_username,
      existing_username.created_at,
      existing_username.updated_at;
    return;
  end if;

  if exists (
    select 1
    from private.reserved_login_usernames as reserved
    where reserved.normalized_username = requested_username
  ) or exists (
    select 1
    from private.login_usernames as mapping
    where mapping.normalized_username = requested_username
  ) then
    raise exception 'Username is unavailable'
      using errcode = 'PT409';
  end if;

  insert into private.login_usernames(
    percent_user_id,
    username,
    normalized_username
  ) values (
    actor,
    requested_username,
    requested_username
  )
  returning
    login_usernames.username,
    login_usernames.normalized_username,
    login_usernames.created_at,
    login_usernames.updated_at
  into
    existing_username.username,
    existing_username.normalized_username,
    existing_username.created_at,
    existing_username.updated_at;

  return query
  select
    existing_username.username,
    existing_username.normalized_username,
    existing_username.created_at,
    existing_username.updated_at;
exception
  when unique_violation then
    raise exception 'Username is unavailable'
      using errcode = 'PT409';
end;
$$;

revoke all on function public.claim_username(text)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_username(text) to authenticated;

create function public.get_my_username()
returns table (
  username text,
  normalized_username text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    mapping.username,
    mapping.normalized_username,
    mapping.created_at,
    mapping.updated_at
  from private.login_usernames as mapping
  where mapping.percent_user_id = private.current_user_id();
$$;

revoke all on function public.get_my_username()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_username() to authenticated;

do $$
declare
  login_table regclass := to_regclass('private.login_usernames');
  reserved_table regclass := to_regclass('private.reserved_login_usernames');
  claim_function oid := to_regprocedure('public.claim_username(text)');
  read_function oid := to_regprocedure('public.get_my_username()');
begin
  if login_table is null or reserved_table is null then
    raise exception 'Username foundation tables were not created';
  end if;

  if not exists (
    select 1 from pg_class where oid = login_table and relrowsecurity
  ) or not exists (
    select 1 from pg_class where oid = reserved_table and relrowsecurity
  ) then
    raise exception 'Username foundation tables must have RLS enabled';
  end if;

  if has_table_privilege('anon', login_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', login_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', reserved_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', reserved_table, 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', login_table, 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', reserved_table, 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Username table privileges are not correctly restricted';
  end if;

  if claim_function is null or read_function is null
     or not exists (
       select 1 from pg_proc
       where oid = claim_function
         and prosecdef
         and provolatile = 'v'
         and prorettype = 'record'::regtype
         and 'search_path=""' = any(proconfig)
     ) or not exists (
       select 1 from pg_proc
       where oid = read_function
         and prosecdef
         and provolatile = 's'
         and prorettype = 'record'::regtype
         and 'search_path=""' = any(proconfig)
     ) then
    raise exception 'Username RPC security configuration is invalid';
  end if;

  if has_function_privilege('anon', 'public.claim_username(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.claim_username(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_username()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_username()', 'EXECUTE') then
    raise exception 'Username RPC privileges are not correctly restricted';
  end if;

  if (select count(*) from private.login_usernames) <> 0 then
    raise exception 'Step 9A must not create username assignments';
  end if;

  if (select count(*) from private.reserved_login_usernames) <> 13 then
    raise exception 'Reserved username seed is incomplete';
  end if;

  if not exists (
    select 1
    from private.percent_principals as principal
    join public.profiles as profile on profile.id = principal.id
    join private.user_roles as role_record on role_record.user_id = principal.id
    where principal.id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and role_record.role = 'super_admin'
  ) or not exists (
    select 1
    from private.external_identities as identity
    where identity.percent_user_id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and identity.provider = 'firebase'
      and identity.issuer = 'https://securetoken.google.com/percent-63d3e'
      and identity.external_subject = 'rcxlqZhTkKhFHor0UignSMwQkSX2'
  ) then
    raise exception 'Percent super_admin identity changed during Step 9A';
  end if;
end;
$$;

commit;

-- Rollback note: these objects are independent of the existing identity root.
-- They may be dropped in reverse dependency order before any username is used.
-- Once username login is enabled, never drop mappings without first preserving
-- a verified email/password or linked-provider login path for every account.
