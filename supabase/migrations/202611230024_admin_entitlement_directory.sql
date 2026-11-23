-- Admin-only, read-only entitlement inventory. Grants and revocations remain
-- separate until owner policy, reason categories and duration rules are approved.

begin;

create or replace function public.get_admin_entitlement_directory(
  p_status text default null,
  p_search text default null
)
returns table (
  entitlement_id uuid,
  user_id uuid,
  learner_email text,
  learner_name text,
  plan_id uuid,
  plan_code text,
  plan_name text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  source_payment_submission_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  status_value text := nullif(lower(trim(coalesce(p_status, ''))), '');
  search_value text := nullif(trim(coalesce(p_search, '')), '');
begin
  if actor_id is null or not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Administrator role required';
  end if;
  if status_value is not null and status_value not in ('active', 'scheduled', 'expired', 'cancelled', 'revoked') then
    raise exception 'Choose a valid entitlement status';
  end if;
  if search_value is not null and char_length(search_value) > 120 then
    raise exception 'Search text must be at most 120 characters';
  end if;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (
    actor_id,
    'entitlement_directory.viewed',
    'user_entitlements',
    jsonb_build_object('status_filter', status_value, 'search_used', search_value is not null)
  );

  return query
  select
    ue.id,
    ue.user_id,
    au.email::text,
    coalesce(nullif(trim(pr.display_name), ''), au.email::text),
    pl.id,
    pl.code,
    pl.name,
    case
      when ue.status <> 'active' then ue.status::text
      when ue.starts_at > now() then 'scheduled'
      when ue.ends_at <= now() then 'expired'
      else 'active'
    end,
    ue.starts_at,
    ue.ends_at,
    ue.source_payment_submission_id,
    ue.created_at
  from public.user_entitlements ue
  join public.plans pl on pl.id = ue.plan_id
  join auth.users au on au.id = ue.user_id
  left join public.profiles pr on pr.user_id = ue.user_id
  where (status_value is null or case
      when ue.status <> 'active' then ue.status::text
      when ue.starts_at > now() then 'scheduled'
      when ue.ends_at <= now() then 'expired'
      else 'active'
    end = status_value)
    and (search_value is null
      or ue.user_id::text ilike '%' || search_value || '%'
      or coalesce(au.email::text, '') ilike '%' || search_value || '%'
      or pl.code ilike '%' || search_value || '%'
      or pl.name ilike '%' || search_value || '%')
  order by ue.created_at desc
  limit 1000;
end;
$$;

revoke all on function public.get_admin_entitlement_directory(text, text) from public, anon;
grant execute on function public.get_admin_entitlement_directory(text, text) to authenticated;

commit;
