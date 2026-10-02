-- REVIEW ONLY: customer route security SQL approval gate. Do not apply yet.
-- Anonymous-auth tokens carry the authenticated database role, so role/grant
-- checks alone do not establish a permanent Percent customer session.
-- Reject them at the shared principal resolver and before Firebase provisioning.
-- Existing issuer/audience/subject checks, roles, UUIDs, ownership policies,
-- checkout calculations and function privileges remain intact.
begin;

do $migration$
declare
  target regprocedure;
  definition text;
  function_record record;
  expected_source_hash text;
  anchor constant text := 'if claims is null';
  replacement constant text :=
    'if claims ->> ''is_anonymous'' = ''true''
     or claims #>> ''{firebase,sign_in_provider}'' = ''anonymous''
     or claims is null';
begin
  foreach target in array array[
    'private.current_user_id()'::regprocedure,
    'public.provision_my_percent_identity()'::regprocedure
  ] loop
    select pg_get_functiondef(target::oid) into definition;
    select prosrc, proconfig, prosecdef, provolatile, pronargs, prorettype
      into function_record from pg_proc where oid = target::oid;
    expected_source_hash := case target
      when 'private.current_user_id()'::regprocedure
        then '2557a80e5b167814febe8f4d4579b02b'
      when 'public.provision_my_percent_identity()'::regprocedure
        then 'd83c173d7aa6eedb89a9302f1b8feea9'
    end;
    -- Fail closed if the deployed implementation differs from the audited body.
    if (length(definition) - length(replace(definition, anchor, '')))
       / length(anchor) <> 1
       or position('auth.jwt()' in definition) = 0
       or position('https://securetoken.google.com/percent-63d3e' in definition) = 0
       or not function_record.prosecdef
       or function_record.proconfig is distinct from array['search_path=""']::text[]
       or function_record.pronargs <> 0
       or function_record.prorettype <> 'uuid'::regtype
       or function_record.provolatile <> (case
         when target = 'private.current_user_id()'::regprocedure then 's' else 'v' end)
       or md5(btrim(replace(function_record.prosrc, chr(13), ''), E' \n\t'))
          is distinct from expected_source_hash then
      raise exception 'Unrecognized identity authorization body: %', target;
    end if;
    -- CREATE OR REPLACE retains the existing ACL and identity checks.
    execute replace(definition, anchor, replacement);
  end loop;
end
$migration$;

commit;
