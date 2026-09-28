begin;

-- One-time, service-role-only bridge used by the dual-proof transition Edge
-- Function. It exposes no email lookup, role mutation, or arbitrary provider.
create function public.link_firebase_identity_transition(
  p_percent_user_id uuid,
  p_issuer text,
  p_external_subject text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_subject_user uuid;
  existing_account_subject text;
begin
  if auth.jwt() ->> 'role' is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_percent_user_id is null
     or p_issuer is distinct from 'https://securetoken.google.com/percent-63d3e'
     or p_external_subject is null
     or p_external_subject is distinct from btrim(p_external_subject)
     or length(p_external_subject) not between 1 and 128 then
    raise exception 'Invalid verified identity' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from private.percent_principals principal
    join private.user_roles role_record on role_record.user_id = principal.id
    where principal.id = p_percent_user_id
      and role_record.role = 'super_admin'
  ) then
    raise exception 'Super Admin identity required' using errcode = '42501';
  end if;

  -- Serialize all transition links. This endpoint is intentionally temporary
  -- and low-volume; the lock makes the one-Firebase-identity rule race-safe.
  lock table private.external_identities in share row exclusive mode;

  select identity.percent_user_id
  into existing_subject_user
  from private.external_identities identity
  where identity.provider = 'firebase'
    and identity.issuer = p_issuer
    and identity.external_subject = p_external_subject;

  if existing_subject_user is not null
     and existing_subject_user <> p_percent_user_id then
    raise exception 'Firebase identity is already linked' using errcode = 'PT409';
  end if;

  select identity.external_subject
  into existing_account_subject
  from private.external_identities identity
  where identity.provider = 'firebase'
    and identity.issuer = p_issuer
    and identity.percent_user_id = p_percent_user_id
  order by identity.created_at, identity.id
  limit 1;

  if existing_account_subject is not null
     and existing_account_subject <> p_external_subject then
    raise exception 'Percent account is already linked' using errcode = 'PT409';
  end if;

  if existing_subject_user = p_percent_user_id then
    return jsonb_build_object('linked', true, 'idempotent', true);
  end if;

  insert into private.external_identities(
    provider,
    issuer,
    external_subject,
    percent_user_id
  ) values (
    'firebase',
    p_issuer,
    p_external_subject,
    p_percent_user_id
  );

  insert into private.audit_logs(actor_id, table_name, operation, row_id)
  values (
    p_percent_user_id,
    'private.external_identities',
    'LINK_FIREBASE',
    p_external_subject
  );

  return jsonb_build_object('linked', true, 'idempotent', false);
end;
$$;

revoke all on function public.link_firebase_identity_transition(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.link_firebase_identity_transition(uuid, text, text)
to service_role;

commit;
