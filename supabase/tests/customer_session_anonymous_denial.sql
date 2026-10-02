-- REVIEW ONLY. Run after approved migration in an isolated test database.
-- Isolated fixture writes only. Transaction rolls back fixtures and claim changes.
begin;

do $test$
declare
  fixture_id uuid := gen_random_uuid();
  fixture_subject text := 'anonymous-fixture-' || fixture_id::text;
begin
  -- Existing mappings make these genuine denial regressions, rather than a
  -- null result caused by a missing principal in the test database.
  insert into private.percent_principals(id) values (fixture_id);
  insert into private.external_identities(provider, issuer, external_subject, percent_user_id)
  values ('firebase', 'https://securetoken.google.com/percent-63d3e', fixture_subject, fixture_id);
  perform set_config('request.jwt.claims', '{}', true);
  if private.current_user_id() is not null then
    raise exception 'Missing authentication resolved a Percent principal';
  end if;

  -- A syntactically valid anonymous Firebase token must fail despite its mapping.
  perform set_config('request.jwt.claims', jsonb_build_object(
    'iss', 'https://securetoken.google.com/percent-63d3e',
    'aud', 'percent-63d3e', 'role', 'authenticated', 'sub', fixture_subject,
    'firebase', jsonb_build_object('sign_in_provider', 'anonymous')
  )::text, true);
  if private.current_user_id() is not null then
    raise exception 'Anonymous Firebase authentication resolved a principal';
  end if;
  begin
    perform public.provision_my_percent_identity();
    raise exception 'Anonymous Firebase provisioning was allowed';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.create_checkout_order('[]'::jsonb, null::uuid, null::uuid, null::text);
    raise exception 'Anonymous checkout was allowed';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.validate_coupon('FIXTURE', '[]'::jsonb);
    raise exception 'Anonymous coupon operation was allowed';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'iss', 'https://gijyjdeohvdrnvqfqdha.supabase.co/auth/v1',
    'aud', 'authenticated', 'role', 'authenticated',
    'sub', fixture_id::text, 'is_anonymous', true
  )::text, true);
  if private.current_user_id() is not null then
    raise exception 'Anonymous Supabase authentication resolved a principal';
  end if;
  -- Permanent authentication must keep resolving the same internal UUID.
  perform set_config('request.jwt.claims', jsonb_build_object(
    'iss', 'https://gijyjdeohvdrnvqfqdha.supabase.co/auth/v1',
    'aud', 'authenticated', 'role', 'authenticated',
    'sub', fixture_id::text, 'is_anonymous', false
  )::text, true);
  if private.current_user_id() is distinct from fixture_id then
    raise exception 'Permanent Supabase authentication no longer resolves';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'iss', 'https://securetoken.google.com/percent-63d3e',
    'aud', 'percent-63d3e', 'role', 'authenticated', 'sub', fixture_subject,
    'firebase', jsonb_build_object('sign_in_provider', 'password')
  )::text, true);
  if private.current_user_id() is distinct from fixture_id then
    raise exception 'Permanent Firebase authentication no longer resolves';
  end if;
end
$test$;

rollback;
