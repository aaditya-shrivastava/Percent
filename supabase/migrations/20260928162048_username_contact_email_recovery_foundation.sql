-- MANUAL EXECUTION ONLY.
-- Run only in Percent (gijyjdeohvdrnvqfqdha) after complete review.
-- Step 9D prepares verified contact-email tokens, recovery target resolution,
-- and authenticated orphan-registration reissue. It sends no email, changes
-- no Firebase account, and enables no username-auth feature.
begin;

do $$
begin
  if to_regclass('private.login_usernames') is null
     or to_regclass('private.username_registration_reservations') is null
     or to_regclass('private.pending_contact_emails') is null
     or to_regclass('private.username_auth_rate_limits') is null
     or to_regprocedure('private.current_user_id()') is null
     or to_regprocedure('public.reserve_username_registration(text,text,bytea,integer)') is null
     or to_regprocedure('public.finalize_username_registration(uuid,bytea)') is null then
    raise exception 'Step 9B prerequisites are missing';
  end if;

  if to_regclass('private.contact_email_verification_tokens') is not null
     or to_regprocedure('public.create_my_contact_email_verification(bytea,integer)') is not null
     or to_regprocedure('public.verify_contact_email(bytea)') is not null
     or to_regprocedure('public.username_auth_get_recovery_target(text)') is not null
     or to_regprocedure('public.recover_my_username_registration(bytea,integer)') is not null
     or to_regprocedure('public.cleanup_contact_email_verification_tokens()') is not null then
    raise exception 'Step 9D objects already exist; stop and inspect migration state';
  end if;

  if exists (
    select 1 from private.percent_principals
    where email is not null
    group by lower(email)
    having count(*) > 1
  ) then
    raise exception 'Verified contact emails are ambiguous; stop for manual review';
  end if;

  if (select count(*) from private.login_usernames) <> 0
     or (select count(*) from private.pending_contact_emails) <> 0 then
    raise exception 'Username/contact-email runtime state differs from the approved gate';
  end if;

  if not exists (
    select 1
    from private.percent_principals p
    join public.profiles profile on profile.id = p.id
    join private.user_roles r on r.user_id = p.id
    join private.external_identities i on i.percent_user_id = p.id
    where p.id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and r.role = 'super_admin'
      and i.provider = 'firebase'
      and i.issuer = 'https://securetoken.google.com/percent-63d3e'
      and i.external_subject = 'rcxlqZhTkKhFHor0UignSMwQkSX2'
  ) then
    raise exception 'Expected Percent super_admin mapping is missing';
  end if;
end;
$$;

-- A verified contact email must resolve to at most one Percent identity for
-- recovery routing. This is not an identity-linking constraint.
create unique index percent_principals_verified_email_key
  on private.percent_principals(lower(email))
  where email is not null;

alter table private.username_registration_reservations
  add column superseded_at timestamptz;

drop index private.username_registration_active_username_key;
create unique index username_registration_active_username_key
  on private.username_registration_reservations(normalized_username)
  where consumed_at is null and superseded_at is null;

create table private.contact_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  percent_user_id uuid not null
    references private.percent_principals(id) on delete cascade,
  email text not null,
  token_hash bytea not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contact_email_verification_token_hash_key unique (token_hash),
  constraint contact_email_verification_token_hash_length check (
    octet_length(token_hash) = 32
  ),
  constraint contact_email_verification_email_format check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 320
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint contact_email_verification_expiry check (expires_at > created_at)
);

create unique index contact_email_verification_current_user_key
  on private.contact_email_verification_tokens(percent_user_id)
  where consumed_at is null;
create index contact_email_verification_expiry_idx
  on private.contact_email_verification_tokens(expires_at);

alter table private.contact_email_verification_tokens enable row level security;
revoke all on private.contact_email_verification_tokens
  from public, anon, authenticated;
grant all on private.contact_email_verification_tokens to service_role;

create function private.immutable_consumed_contact_email_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.consumed_at is not null then
    raise exception 'Consumed contact-email tokens are immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.immutable_consumed_contact_email_token()
  from public, anon, authenticated, service_role;

create trigger immutable_consumed_contact_email_token
before update on private.contact_email_verification_tokens
for each row execute function private.immutable_consumed_contact_email_token();

-- Replaces Step 9B reservation creation so expired records remain available
-- for authenticated orphan recovery instead of being deleted.
create or replace function public.reserve_username_registration(
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

  update private.username_registration_reservations r
  set superseded_at = now()
  where r.normalized_username = canonical
    and r.consumed_at is null
    and r.superseded_at is null
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

create function public.create_my_contact_email_verification(
  p_token_hash bytea,
  p_ttl_seconds integer default 86400
)
returns table (contact_email text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  pending_email text;
  new_expiry timestamptz;
begin
  if actor is null then
    raise exception 'Authenticated Percent identity required' using errcode = '42501';
  end if;
  if octet_length(p_token_hash) <> 32
     or p_ttl_seconds not between 900 and 172800 then
    raise exception 'Invalid verification request' using errcode = '22023';
  end if;

  select p.email into pending_email
  from private.pending_contact_emails p
  where p.percent_user_id = actor
    and p.verification_state = 'pending'
  for update;
  if pending_email is null then
    raise exception 'No pending contact email' using errcode = 'PT409';
  end if;

  if exists (
    select 1 from private.percent_principals p
    where p.email = pending_email and p.id <> actor
  ) then
    raise exception 'Contact email unavailable' using errcode = 'PT409';
  end if;

  update private.contact_email_verification_tokens
  set consumed_at = now()
  where percent_user_id = actor and consumed_at is null;

  new_expiry := now() + make_interval(secs => p_ttl_seconds);
  insert into private.contact_email_verification_tokens(
    percent_user_id, email, token_hash, expires_at
  ) values (actor, pending_email, p_token_hash, new_expiry);

  return query select pending_email, new_expiry;
exception
  when unique_violation then
    raise exception 'Verification token conflict' using errcode = 'PT409';
end;
$$;

create function public.verify_contact_email(p_token_hash bytea)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  token_record private.contact_email_verification_tokens%rowtype;
begin
  if octet_length(p_token_hash) <> 32 then return false; end if;

  select t.* into token_record
  from private.contact_email_verification_tokens t
  where t.token_hash = p_token_hash
  for update;
  if not found then return false; end if;

  if token_record.consumed_at is not null then
    return exists (
      select 1 from private.percent_principals p
      where p.id = token_record.percent_user_id and p.email = token_record.email
    );
  end if;
  if token_record.expires_at <= now() then return false; end if;

  if not exists (
    select 1 from private.pending_contact_emails p
    where p.percent_user_id = token_record.percent_user_id
      and p.email = token_record.email
      and p.verification_state = 'pending'
  ) or exists (
    select 1 from private.percent_principals p
    where p.email = token_record.email and p.id <> token_record.percent_user_id
  ) then
    return false;
  end if;

  update private.percent_principals
  set email = token_record.email
  where id = token_record.percent_user_id
    and (email is null or email = token_record.email);
  if not found then return false; end if;

  update private.contact_email_verification_tokens
  set consumed_at = now()
  where id = token_record.id;
  delete from private.pending_contact_emails
  where percent_user_id = token_record.percent_user_id
    and email = token_record.email;
  return true;
exception
  when unique_violation then return false;
end;
$$;

create function public.username_auth_get_recovery_target(p_identifier text)
returns table (login_alias text, verified_contact_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  canonical text := lower(btrim(p_identifier));
begin
  if p_identifier is null or char_length(p_identifier) > 320 then return; end if;

  if position('@' in canonical) > 0 then
    return query
    select min(u.firebase_login_alias), min(p.email)
    from private.percent_principals p
    join private.login_usernames u on u.percent_user_id = p.id
    where p.email = canonical and u.alias_activated_at is not null
    having count(*) = 1;
  elsif canonical ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
        and canonical !~ '[._][._]' then
    return query
    select u.firebase_login_alias, p.email
    from private.login_usernames u
    join private.percent_principals p on p.id = u.percent_user_id
    where u.normalized_username = canonical
      and u.alias_activated_at is not null
      and p.email is not null;
  end if;
end;
$$;

create function public.recover_my_username_registration(
  p_new_secret_hash bytea,
  p_ttl_seconds integer default 900
)
returns table (reservation_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  claims jsonb := auth.jwt();
  token_alias text := lower(claims ->> 'email');
  reservation private.username_registration_reservations%rowtype;
  new_expiry timestamptz;
begin
  if actor is null
     or claims ->> 'iss' is distinct from 'https://securetoken.google.com/percent-63d3e'
     or claims ->> 'aud' is distinct from 'percent-63d3e'
     or claims ->> 'role' is distinct from 'authenticated'
     or claims #>> '{firebase,sign_in_provider}' is distinct from 'password'
     or token_alias !~ '^u_[0-9a-f]{32}@login[.]percent[.]invalid$'
     or octet_length(p_new_secret_hash) <> 32
     or p_ttl_seconds not between 300 and 900 then
    raise exception 'Verified Percent Firebase alias authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from private.external_identities i
    where i.percent_user_id = actor
      and i.provider = 'firebase'
      and i.issuer = claims ->> 'iss'
      and i.external_subject = claims ->> 'sub'
  ) then
    raise exception 'Firebase identity mapping required' using errcode = '42501';
  end if;

  select r.* into reservation
  from private.username_registration_reservations r
  where r.firebase_login_alias = token_alias
    and r.consumed_at is null
  order by r.created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'Recoverable registration not found' using errcode = 'PT409';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(reservation.normalized_username, 9));
  if exists (
    select 1 from private.login_usernames u
    where u.normalized_username = reservation.normalized_username
  ) or exists (
    select 1 from private.username_registration_reservations r
    where r.id <> reservation.id
      and r.normalized_username = reservation.normalized_username
      and r.consumed_at is null
      and r.superseded_at is null
      and r.expires_at > now()
  ) then
    raise exception 'Registration username is no longer available'
      using errcode = 'PT409';
  end if;

  new_expiry := now() + make_interval(secs => p_ttl_seconds);
  update private.username_registration_reservations
  set reservation_secret_hash = p_new_secret_hash,
      expires_at = new_expiry,
      superseded_at = null
  where id = reservation.id;
  return query select reservation.id, new_expiry;
end;
$$;

create function public.cleanup_contact_email_verification_tokens()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare deleted_count bigint;
begin
  delete from private.contact_email_verification_tokens
  where (consumed_at is not null and consumed_at < now() - interval '7 days')
     or (consumed_at is null and expires_at < now() - interval '7 days');
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.create_my_contact_email_verification(bytea,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.verify_contact_email(bytea)
  from public, anon, authenticated, service_role;
revoke all on function public.username_auth_get_recovery_target(text)
  from public, anon, authenticated, service_role;
revoke all on function public.recover_my_username_registration(bytea,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.cleanup_contact_email_verification_tokens()
  from public, anon, authenticated, service_role;

grant execute on function public.create_my_contact_email_verification(bytea,integer)
  to authenticated;
grant execute on function public.verify_contact_email(bytea) to service_role;
grant execute on function public.username_auth_get_recovery_target(text) to service_role;
grant execute on function public.recover_my_username_registration(bytea,integer)
  to authenticated;
grant execute on function public.cleanup_contact_email_verification_tokens()
  to service_role;

do $$
begin
  if (select count(*) from private.contact_email_verification_tokens) <> 0 then
    raise exception 'Step 9D must not create verification tokens';
  end if;
  if (select count(*) from private.login_usernames) <> 0
     or (select count(*) from private.pending_contact_emails) <> 0 then
    raise exception 'Step 9D must not create usernames or pending emails';
  end if;
  if has_table_privilege('anon','private.contact_email_verification_tokens','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','private.contact_email_verification_tokens','SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role','private.contact_email_verification_tokens','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Verification-token table privileges are incorrect';
  end if;
  if has_function_privilege('anon','public.verify_contact_email(bytea)','EXECUTE')
     or has_function_privilege('authenticated','public.verify_contact_email(bytea)','EXECUTE')
     or not has_function_privilege('service_role','public.verify_contact_email(bytea)','EXECUTE')
     or has_function_privilege('anon','public.recover_my_username_registration(bytea,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.recover_my_username_registration(bytea,integer)','EXECUTE') then
    raise exception 'Step 9D function privileges are incorrect';
  end if;
  if not exists (
    select 1
    from private.percent_principals p
    join public.profiles profile on profile.id = p.id
    join private.user_roles r on r.user_id = p.id
    join private.external_identities i on i.percent_user_id = p.id
    where p.id = '705e0372-056e-4b73-93fb-4282ba335b35'::uuid
      and r.role = 'super_admin'
      and i.provider = 'firebase'
      and i.issuer = 'https://securetoken.google.com/percent-63d3e'
      and i.external_subject = 'rcxlqZhTkKhFHor0UignSMwQkSX2'
  ) then
    raise exception 'Percent super_admin identity changed during Step 9D';
  end if;
end;
$$;

commit;

-- Email delivery remains disabled until Resend credentials, a verified sender,
-- PERCENT_AUTH_EMAIL_ENABLED=true, and the extended Edge Function pass review.
