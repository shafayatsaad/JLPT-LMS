-- Audited staff role directory and role assignment operations for admins.
-- The initial administrator still must be assigned from the Supabase SQL Editor.

begin;

create or replace function public.get_admin_user_directory()
returns table (
  user_id uuid,
  email text,
  display_name text,
  registered_at timestamptz,
  roles text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Administrator role required';
  end if;
  return query
  select u.id, u.email::text, p.display_name, u.created_at,
    coalesce(array_agg(ur.role::text order by ur.role::text) filter (where ur.role is not null), array[]::text[])
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.user_roles ur on ur.user_id = u.id
  group by u.id, u.email, p.display_name, u.created_at
  order by u.created_at desc
  limit 500;
end;
$$;

revoke all on function public.get_admin_user_directory() from public, anon;
grant execute on function public.get_admin_user_directory() to authenticated;

create or replace function public.manage_user_role(
  p_user_id uuid,
  p_role text,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  role_value public.app_role;
  changed boolean := false;
  admin_count integer;
begin
  if actor_id is null or not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Administrator role required';
  end if;
  if p_user_id is null or p_role is null or p_action is null or p_action not in ('grant', 'revoke') then
    raise exception 'A user, role and grant/revoke action are required';
  end if;
  if p_role not in ('content_editor', 'reviewer', 'payment_reviewer', 'support_agent', 'admin') then
    raise exception 'Only staff roles can be managed here';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'The account ID does not match a registered user';
  end if;
  role_value := p_role::public.app_role;

  -- Serialize administrator changes so concurrent removals cannot remove the
  -- final administrator account.
  perform pg_advisory_xact_lock(hashtextextended('admin-user-role-management', 0));
  if p_role = 'admin' and p_action = 'revoke' then
    select count(*) into admin_count from public.user_roles where role = 'admin'::public.app_role;
    if admin_count <= 1 then raise exception 'The final administrator role cannot be removed'; end if;
  end if;

  if p_action = 'grant' then
    insert into public.user_roles (user_id, role, assigned_by)
    values (p_user_id, role_value, actor_id)
    on conflict (user_id, role) do nothing;
    changed := found;
  else
    delete from public.user_roles where user_id = p_user_id and role = role_value;
    changed := found;
  end if;

  if changed then
    insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (actor_id, 'user_role.' || p_action, 'user_role', p_user_id,
      case when p_action = 'revoke' then jsonb_build_object('role', p_role, 'assigned', true) else null end,
      case when p_action = 'grant' then jsonb_build_object('role', p_role, 'assigned', true) else jsonb_build_object('role', p_role, 'assigned', false) end);
  end if;
  return changed;
end;
$$;

revoke all on function public.manage_user_role(uuid, text, text) from public, anon;
grant execute on function public.manage_user_role(uuid, text, text) to authenticated;

commit;
