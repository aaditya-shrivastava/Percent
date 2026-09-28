-- MANUAL EXECUTION ONLY.
-- Run only in Percent (gijyjdeohvdrnvqfqdha) after complete review.
-- Step 9B prepares registration reservations, explicit alias activation state,
-- pending contact email, durable throttling, and narrow RPCs. It does not
-- create usernames, change Firebase accounts, or enable username login.
begin;

do $$
begin
  if to_regclass('private.login_usernames') is null
     or to_regclass('private.reserved_login_usernames') is null
     or to_regclass('private.percent_principals') is null
     or to_regclass('private.external_identities') is null
     or to_regprocedure('private.current_user_id()') is null
     or to_regprocedure('public.provision_my_percent_identity()') is null
     or to_regprocedure('public.claim_username(text)') is null
     or to_regprocedure('public.get_my_username()') is null then
    raise exception 'Step 9A identity and username prerequisites are missing';
  end if;

  if to_regclass('private.username_registration_reservations') is not null
     or to_regclass('private.pending_contact_emails') is not null
     or to_regclass('private.username_auth_rate_limits') is not null
     or to_regprocedure('public.username_auth_check_availability(text)') is not null
     or to_regprocedure('public.username_auth_resolve_login(text)') is not null
     or to_regprocedure('public.reserve_username_registration(text,text,bytea,integer)') is not null
     or to_regprocedure('public.release_username_registration(uuid,bytea)') is not null
     or to_regprocedure('public.finalize_username_registration(uuid,bytea)') is not null
     or to_regprocedure('public.consume_username_auth_rate_limit(text,bytea,integer,integer)') is not null then
    raise exception 'Step 9B objects already exist; stop and inspect migration state';
  end if;

  if (select count(*) from private.login_usernames) <> 0
     or (select count(*) from private.reserved_login_usernames) <> 13 then
    raise exception 'Step 9A username state differs from the approved deployment';
  end if;

  if not exists (
    select 1
    from private.percent_principals as principal
    join public.profiles as profile on profile.id = principal.id
    join private.user_roles as role_record on role_record.user_id = principal.id
    join private.external_identities as identity on identity.percent_user_id = principal.id
    where principal.id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and role_record.role = 'super_admin'
      and identity.provider = 'firebase'
      and identity.issuer = 'https://securetoken.google.com/percent-63d3e'
      and identity.external_subject = 'rcxlqZhTkKhFHor0UignSMwQkSX2'
  ) then
    raise exception 'Expected Percent super_admin mapping is missing';
  end if;
end;
$$;

alter table private.login_usernames
  add column alias_activated_at timestamptz;

comment on column private.login_usernames.alias_activated_at is
  'Null means username claimed but opaque-alias login is not active.';

create table private.username_registration_reservations (
  id uuid primary key default gen_random_uuid(),
  normalized_username text not null,
  firebase_login_alias text not null,
  pending_contact_email text not null,
  reservation_secret_hash bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references private.percent_principals(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint username_registration_username_format check (
    char_length(normalized_username) between 3 and 24
    and normalized_username = lower(normalized_username)
    and normalized_username ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
    and normalized_username !~ '[._][._]'
  ),
  constraint username_registration_alias_key unique (firebase_login_alias),
  constraint username_registration_alias_format check (
    firebase_login_alias ~ '^u_[0-9a-f]{32}@login[.]percent[.]invalid$'
  ),
  constraint username_registration_contact_email check (
    pending_contact_email = lower(btrim(pending_contact_email))
    and char_length(pending_contact_email) between 3 and 320
    and pending_contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint username_registration_secret_hash_length check (
    octet_length(reservation_secret_hash) = 32
  ),
  constraint username_registration_expiry check (expires_at > created_at),
  constraint username_registration_consumption check (
    (consumed_at is null and consumed_by is null)
    or (consumed_at is not null and consumed_by is not null)
  )
);

create unique index username_registration_active_username_key
  on private.username_registration_reservations(normalized_username)
  where consumed_at is null;

create index username_registration_expiry_idx
  on private.username_registration_reservations(expires_at)
  where consumed_at is null;

create table private.pending_contact_emails (
  percent_user_id uuid primary key
    references private.percent_principals(id) on delete cascade,
  email text not null,
  verification_state text not null default 'pending'
    check (verification_state = 'pending'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pending_contact_email_format check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  )
);

create table private.username_auth_rate_limits (
  operation text not null check (operation in (
    'availability', 'resolve_login', 'reserve_registration', 'recovery'
  )),
  key_hash bytea not null check (octet_length(key_hash) = 32),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (operation, key_hash, window_started_at)
);

create index username_auth_rate_limits_cleanup_idx
  on private.username_auth_rate_limits(window_started_at);

alter table private.username_registration_reservations enable row level security;
alter table private.pending_contact_emails enable row level security;
alter table private.username_auth_rate_limits enable row level security;

revoke all on table
  private.username_registration_reservations,
  private.pending_contact_emails,
  private.username_auth_rate_limits
from public, anon, authenticated;

grant all on table
  private.username_registration_reservations,
  private.pending_contact_emails,
  private.username_auth_rate_limits
to service_role;

create function private.immutable_consumed_username_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.consumed_at is not null then
    raise exception 'Consumed username reservations are immutable'
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.immutable_consumed_username_reservation()
  from public, anon, authenticated, service_role;

create trigger immutable_consumed_username_reservation
before update or delete on private.username_registration_reservations
for each row execute function private.immutable_consumed_username_reservation();

create function public.username_auth_check_availability(p_username text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  canonical text;
begin
  if p_username is null or p_username is distinct from btrim(p_username) then
    return false;
  end if;
  canonical := lower(p_username);
  if char_length(canonical) not between 3 and 24
     or canonical !~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
     or canonical ~ '[._][._]' then
    return false;
  end if;
  return not exists (
    select 1 from private.reserved_login_usernames r
    where r.normalized_username = canonical
  ) and not exists (
    select 1 from private.login_usernames u
    where u.normalized_username = canonical
  ) and not exists (
    select 1 from private.username_registration_reservations r
    where r.normalized_username = canonical
      and r.consumed_at is null
      and r.expires_at > now()
  );
end;
$$;

create function public.username_auth_resolve_login(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  canonical text := lower(btrim(p_identifier));
  resolved_alias text;
begin
  if p_identifier is null or char_length(p_identifier) > 320 then
    return null;
  end if;

  if position('@' in canonical) > 0 then
    select min(u.firebase_login_alias)
    into resolved_alias
    from private.percent_principals p
    join private.login_usernames u on u.percent_user_id = p.id
    where p.email = canonical
      and u.alias_activated_at is not null
    having count(*) = 1;
  elsif canonical ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
        and canonical !~ '[._][._]' then
    select u.firebase_login_alias
    into resolved_alias
    from private.login_usernames u
    where u.normalized_username = canonical
      and u.alias_activated_at is not null;
  end if;

  return resolved_alias;
end;
$$;

create function public.reserve_username_registration(
  p_username text,
  p_contact_email text,
  p_secret_hash bytea,
  p_ttl_seconds integer default 900
)
returns table (reservation_id uuid, login_alias text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  canonical text;
  contact_email text;
  new_alias text;
  new_id uuid;
  new_expiry timestamptz;
begin
  if p_username is null or p_username is distinct from btrim(p_username) then
    raise exception 'Username unavailable' using errcode = 'PT409';
  end if;
  canonical := lower(p_username);
  contact_email := lower(btrim(p_contact_email));

  if char_length(canonical) not between 3 and 24
     or canonical !~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
     or canonical ~ '[._][._]'
     or contact_email is null
     or char_length(contact_email) not between 3 and 320
     or contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or octet_length(p_secret_hash) <> 32
     or p_ttl_seconds not between 300 and 900 then
    raise exception 'Invalid registration request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(canonical, 9));
  delete from private.username_registration_reservations r
  where r.normalized_username = canonical
    and r.consumed_at is null
    and r.expires_at <= now();

  if not public.username_auth_check_availability(canonical) then
    raise exception 'Username unavailable' using errcode = 'PT409';
  end if;

  new_id := gen_random_uuid();
  new_alias := 'u_' || replace(gen_random_uuid()::text, '-', '') || '@login.percent.invalid';
  new_expiry := now() + make_interval(secs => p_ttl_seconds);

  insert into private.username_registration_reservations(
    id, normalized_username, firebase_login_alias, pending_contact_email,
    reservation_secret_hash, expires_at
  ) values (
    new_id, canonical, new_alias, contact_email, p_secret_hash, new_expiry
  );

  return query select new_id, new_alias, new_expiry;
exception
  when unique_violation then
    raise exception 'Username unavailable' using errcode = 'PT409';
end;
$$;

create function public.release_username_registration(
  p_reservation_id uuid,
  p_secret_hash bytea
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_reservation_id is null or octet_length(p_secret_hash) <> 32 then
    return false;
  end if;
  delete from private.username_registration_reservations r
  where r.id = p_reservation_id
    and r.reservation_secret_hash = p_secret_hash
    and r.consumed_at is null;
  return found;
end;
$$;

create function public.finalize_username_registration(
  p_reservation_id uuid,
  p_secret_hash bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  claims jsonb := auth.jwt();
  reservation private.username_registration_reservations%rowtype;
  existing private.login_usernames%rowtype;
begin
  if actor is null
     or claims ->> 'iss' is distinct from 'https://securetoken.google.com/percent-63d3e'
     or claims ->> 'aud' is distinct from 'percent-63d3e'
     or claims ->> 'role' is distinct from 'authenticated'
     or claims #>> '{firebase,sign_in_provider}' is distinct from 'password'
     or p_reservation_id is null
     or octet_length(p_secret_hash) <> 32 then
    raise exception 'Verified Percent Firebase password authentication required'
      using errcode = '42501';
  end if;

  select r.* into reservation
  from private.username_registration_reservations r
  where r.id = p_reservation_id
  for update;

  if not found or reservation.reservation_secret_hash is distinct from p_secret_hash then
    raise exception 'Invalid registration reservation' using errcode = '42501';
  end if;

  if reservation.consumed_at is not null then
    if reservation.consumed_by = actor and exists (
      select 1 from private.login_usernames u
      where u.percent_user_id = actor
        and u.normalized_username = reservation.normalized_username
        and u.firebase_login_alias = reservation.firebase_login_alias
        and u.alias_activated_at is not null
    ) then
      return actor;
    end if;
    raise exception 'Registration reservation already consumed' using errcode = 'PT409';
  end if;

  if reservation.expires_at <= now() then
    raise exception 'Registration reservation expired' using errcode = 'PT409';
  end if;

  -- The opaque .invalid alias is intentionally non-deliverable and therefore
  -- cannot be email-verified. The trusted Firebase JWT, exact alias match, and
  -- high-entropy reservation proof establish ownership; contact-email
  -- verification is a separate future workflow.
  if lower(claims ->> 'email') is distinct from reservation.firebase_login_alias then
    raise exception 'Firebase login alias does not match reservation'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from private.external_identities i
    where i.percent_user_id = actor
      and i.provider = 'firebase'
      and i.issuer = claims ->> 'iss'
      and i.external_subject = claims ->> 'sub'
  ) then
    raise exception 'Firebase identity is not mapped to the current Percent identity'
      using errcode = '42501';
  end if;

  select u.* into existing
  from private.login_usernames u
  where u.percent_user_id = actor;

  if found and (
    existing.normalized_username is distinct from reservation.normalized_username
    or existing.firebase_login_alias is distinct from reservation.firebase_login_alias
  ) then
    raise exception 'A different username is already assigned to this account'
      using errcode = 'PT409';
  end if;

  if not found then
    insert into private.login_usernames(
      percent_user_id, username, normalized_username,
      firebase_login_alias, alias_activated_at
    ) values (
      actor, reservation.normalized_username, reservation.normalized_username,
      reservation.firebase_login_alias, now()
    );
  elsif existing.alias_activated_at is null then
    update private.login_usernames
    set alias_activated_at = now()
    where percent_user_id = actor;
  end if;

  if exists (
    select 1 from private.percent_principals p
    where p.id = actor and p.email is null
  ) then
    insert into private.pending_contact_emails(percent_user_id, email)
    values (actor, reservation.pending_contact_email)
    on conflict (percent_user_id) do update
      set updated_at = now()
      where private.pending_contact_emails.email = excluded.email
        and private.pending_contact_emails.verification_state = 'pending';

    if not found then
      raise exception 'A different pending contact email already exists'
        using errcode = 'PT409';
    end if;
  end if;

  update private.username_registration_reservations
  set consumed_at = now(), consumed_by = actor
  where id = reservation.id;

  return actor;
exception
  when unique_violation then
    raise exception 'Username registration conflict' using errcode = 'PT409';
end;
$$;

create function public.consume_username_auth_rate_limit(
  p_operation text,
  p_key_hash bytea,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  window_start timestamptz;
  current_count integer;
begin
  if p_operation not in ('availability','resolve_login','reserve_registration','recovery')
     or octet_length(p_key_hash) <> 32
     or p_limit not between 1 and 1000
     or p_window_seconds not between 10 and 86400 then
    raise exception 'Invalid rate limit request' using errcode = '22023';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into private.username_auth_rate_limits(
    operation, key_hash, window_started_at, request_count
  ) values (p_operation, p_key_hash, window_start, 1)
  on conflict (operation, key_hash, window_started_at) do update
    set request_count = private.username_auth_rate_limits.request_count + 1,
        updated_at = now()
  returning request_count into current_count;

  delete from private.username_auth_rate_limits
  where window_started_at < now() - interval '2 days';

  return current_count <= p_limit;
end;
$$;

revoke all on function public.username_auth_check_availability(text)
  from public, anon, authenticated, service_role;
revoke all on function public.username_auth_resolve_login(text)
  from public, anon, authenticated, service_role;
revoke all on function public.reserve_username_registration(text,text,bytea,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.release_username_registration(uuid,bytea)
  from public, anon, authenticated, service_role;
revoke all on function public.consume_username_auth_rate_limit(text,bytea,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_username_registration(uuid,bytea)
  from public, anon, authenticated, service_role;

grant execute on function public.username_auth_check_availability(text) to service_role;
grant execute on function public.username_auth_resolve_login(text) to service_role;
grant execute on function public.reserve_username_registration(text,text,bytea,integer) to service_role;
grant execute on function public.release_username_registration(uuid,bytea) to service_role;
grant execute on function public.consume_username_auth_rate_limit(text,bytea,integer,integer) to service_role;
grant execute on function public.finalize_username_registration(uuid,bytea) to authenticated;

do $$
begin
  if (select count(*) from private.login_usernames) <> 0 then
    raise exception 'Step 9B must not assign usernames automatically';
  end if;

  if exists (
    select 1 from private.username_registration_reservations
  ) or exists (
    select 1 from private.pending_contact_emails
  ) or exists (
    select 1 from private.username_auth_rate_limits
  ) then
    raise exception 'Step 9B must not create runtime registration data';
  end if;

  if has_table_privilege('anon','private.username_registration_reservations','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','private.username_registration_reservations','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','private.pending_contact_emails','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','private.pending_contact_emails','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','private.username_auth_rate_limits','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','private.username_auth_rate_limits','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Step 9B private table privileges are too broad';
  end if;

  if has_function_privilege('anon','public.finalize_username_registration(uuid,bytea)','EXECUTE')
     or not has_function_privilege('authenticated','public.finalize_username_registration(uuid,bytea)','EXECUTE')
     or has_function_privilege('authenticated','public.reserve_username_registration(text,text,bytea,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.reserve_username_registration(text,text,bytea,integer)','EXECUTE') then
    raise exception 'Step 9B function privileges are incorrect';
  end if;

  if not exists (
    select 1
    from private.percent_principals as principal
    join public.profiles as profile on profile.id = principal.id
    join private.user_roles as role_record on role_record.user_id = principal.id
    join private.external_identities as identity on identity.percent_user_id = principal.id
    where principal.id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and role_record.role = 'super_admin'
      and identity.provider = 'firebase'
      and identity.issuer = 'https://securetoken.google.com/percent-63d3e'
      and identity.external_subject = 'rcxlqZhTkKhFHor0UignSMwQkSX2'
  ) then
    raise exception 'Percent super_admin identity changed during Step 9B';
  end if;
end;
$$;

commit;

-- Username auth must remain disabled until a verified contact-email delivery
-- and alias-password recovery service exists. Edge functions must additionally
-- enforce PERCENT_USERNAME_AUTH_ENABLED=false until that acceptance gate passes.
