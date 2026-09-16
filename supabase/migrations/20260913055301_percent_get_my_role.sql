-- Approved exception: expose only the current caller's existing protected role.
-- Invoker rights reuse private.user_roles grants and its read_own_role RLS policy.
-- No private schema exposure, elevated rights, role copies, or user-id arguments.
create function public.get_my_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select r.role
  from private.user_roles as r
  where auth.uid() is not null
    and r.user_id = auth.uid();
$$;

revoke all on function public.get_my_role() from public, anon, authenticated, service_role;
grant execute on function public.get_my_role() to authenticated;
