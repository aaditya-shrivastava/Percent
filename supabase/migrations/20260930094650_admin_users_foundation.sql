begin;

-- Staff identities remain rooted in private.percent_principals and
-- private.user_roles. These RPCs expose only the minimum fields needed by the
-- Admin Users screen; the underlying private tables remain unavailable.

create or replace function public.admin_list_staff(
  search_text text default null,
  role_filter text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  safe_search text := nullif(btrim(coalesce(search_text, '')), '');
  safe_filter text := lower(btrim(coalesce(role_filter, 'all')));
  result jsonb;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if safe_filter not in ('all', 'admin', 'super_admin') then
    raise exception 'Invalid staff role filter' using errcode = '22023';
  end if;

  with staff as materialized (
    select
      principal.id,
      profile.display_name,
      principal.email,
      role_record.role,
      principal.created_at,
      role_record.updated_at,
      principal.id = actor as is_current
    from private.user_roles as role_record
    join private.percent_principals as principal
      on principal.id = role_record.user_id
    left join public.profiles as profile
      on profile.id = principal.id
    where role_record.role in ('admin', 'super_admin')
      and (safe_filter = 'all' or role_record.role = safe_filter)
      and (
        safe_search is null
        or coalesce(profile.display_name, '') ilike '%' || safe_search || '%'
        or coalesce(principal.email, '') ilike '%' || safe_search || '%'
      )
  )
  select jsonb_build_object(
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', staff.id,
          'display_name', staff.display_name,
          'email', staff.email,
          'role', staff.role,
          'created_at', staff.created_at,
          'updated_at', staff.updated_at,
          'is_current', staff.is_current
        )
        order by
          case staff.role when 'super_admin' then 0 else 1 end,
          lower(coalesce(staff.display_name, staff.email, '')),
          staff.id
      ),
      '[]'::jsonb
    ),
    'count', count(*),
    'admin_count', count(*) filter (where staff.role = 'admin'),
    'super_admin_count', count(*) filter (where staff.role = 'super_admin'),
    'can_manage_roles', exists (
      select 1
      from private.user_roles as actor_role
      where actor_role.user_id = actor
        and actor_role.role = 'super_admin'
    )
  )
  into result
  from staff;

  return result;
end;
$$;

create or replace function public.admin_set_staff_role(
  target_user_id uuid,
  new_role text,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  actor_role text;
  target_role text;
  target_updated_at timestamptz;
  normalized_role text := lower(btrim(coalesce(new_role, '')));
  changed_at timestamptz;
begin
  if actor is null then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;

  select role_record.role
  into actor_role
  from private.user_roles as role_record
  where role_record.user_id = actor;

  if actor_role is distinct from 'super_admin' then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;

  if target_user_id is null or target_user_id = actor then
    raise exception 'You cannot change your own staff role' using errcode = '22023';
  end if;

  if normalized_role not in ('customer', 'admin', 'super_admin') then
    raise exception 'Invalid staff role' using errcode = '22023';
  end if;

  if expected_updated_at is null then
    raise exception 'A current role revision is required' using errcode = '22023';
  end if;

  -- Serialize all staff-role changes so the final-super-admin invariant cannot
  -- be defeated by concurrent demotions.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('percent.staff-role-management', 0)
  );

  select role_record.role, role_record.updated_at
  into target_role, target_updated_at
  from private.user_roles as role_record
  where role_record.user_id = target_user_id
  for update;

  if target_role is null or target_role not in ('admin', 'super_admin') then
    raise exception 'Staff account not found' using errcode = 'P0002';
  end if;

  if target_updated_at is distinct from expected_updated_at then
    raise exception 'Staff role changed since it was loaded'
      using errcode = 'PT409';
  end if;

  if target_role = normalized_role then
    return jsonb_build_object(
      'id', target_user_id,
      'role', target_role,
      'updated_at', target_updated_at
    );
  end if;

  if target_role = 'super_admin'
     and normalized_role <> 'super_admin'
     and (select count(*) from private.user_roles where role = 'super_admin') <= 1 then
    raise exception 'The final Super Admin cannot be removed'
      using errcode = '22023';
  end if;

  changed_at := clock_timestamp();

  update private.user_roles
  set role = normalized_role,
      updated_at = changed_at
  where user_id = target_user_id;

  insert into private.audit_logs(actor_id, table_name, operation, row_id)
  values (
    actor,
    'private.user_roles',
    'STAFF_ROLE_CHANGED:' || target_role || '->' || normalized_role,
    target_user_id::text
  );

  return jsonb_build_object(
    'id', target_user_id,
    'role', normalized_role,
    'updated_at', changed_at
  );
end;
$$;

revoke all on function public.admin_list_staff(text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_staff(text, text) to authenticated;

revoke all on function public.admin_set_staff_role(uuid, text, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_staff_role(uuid, text, timestamptz) to authenticated;

comment on function public.admin_list_staff(text, text) is
  'Returns the minimal staff-only Admin Users document to an internally authorized Percent Admin.';

comment on function public.admin_set_staff_role(uuid, text, timestamptz) is
  'Allows only an internally authorized Super Admin to change another existing staff role with optimistic concurrency and final-Super-Admin protection.';

commit;
