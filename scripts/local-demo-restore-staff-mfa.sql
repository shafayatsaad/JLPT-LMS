-- Restore the production staff AAL2 rule after closing remote demo mode.
-- This mirrors migration 202611230025_staff_mfa_assurance.sql.
create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
      and (
        ur.role = 'student'::public.app_role
        or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      )
  );
$$;

create or replace function private.has_any_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any(required_roles)
      and (
        ur.role = 'student'::public.app_role
        or coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      )
  );
$$;
