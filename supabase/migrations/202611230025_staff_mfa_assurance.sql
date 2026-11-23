-- Require Supabase AAL2 for every staff role check, including direct RPC/RLS access.
-- Learner-only checks remain available at AAL1. Apply after migration 002.

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

-- This support helper predates the common role helpers and used to read roles directly.
-- Route it through has_any_role so support-agent RPCs and policies also require AAL2.
create or replace function private.can_manage_support()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_any_role(array[
    'admin'::public.app_role,
    'support_agent'::public.app_role
  ]));
$$;

-- CREATE OR REPLACE keeps the existing EXECUTE grants on all three helpers.
