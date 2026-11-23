-- Role-aware aggregate workspace summary. No learner-level records are returned.

create or replace function public.get_admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_admin boolean;
  actor_is_reviewer boolean;
  actor_is_payment_staff boolean;
  actor_is_support_staff boolean;
  summary jsonb;
begin
  if actor_id is null then raise exception 'Sign-in is required'; end if;
  actor_is_admin := (select private.has_role('admin'::public.app_role));
  actor_is_reviewer := (select private.has_any_role(array['admin'::public.app_role, 'reviewer'::public.app_role]));
  actor_is_payment_staff := (select private.has_any_role(array['admin'::public.app_role, 'payment_reviewer'::public.app_role]));
  actor_is_support_staff := (select private.has_any_role(array['admin'::public.app_role, 'support_agent'::public.app_role]));
  if not (actor_is_admin or actor_is_reviewer or actor_is_payment_staff or actor_is_support_staff
    or (select private.has_role('content_editor'::public.app_role))) then
    raise exception 'Staff access is required';
  end if;

  select jsonb_build_object(
    'new_accounts_7d', case when actor_is_admin then (
      select count(*)::integer from public.profiles p where p.created_at >= now() - interval '7 days'
    ) else null end,
    'active_premium_accounts', case when actor_is_admin then (
      select count(distinct e.user_id)::integer from public.user_entitlements e
      where e.status = 'active' and e.starts_at <= now() and e.ends_at > now()
    ) else null end,
    'premium_expiring_7d', case when actor_is_admin then (
      select count(*)::integer from (
        select e.user_id, max(e.ends_at) as latest_active_expiry
        from public.user_entitlements e
        where e.status = 'active' and e.starts_at <= now() and e.ends_at > now()
        group by e.user_id
      ) active_access
      where active_access.latest_active_expiry <= now() + interval '7 days'
    ) else null end,
    'published_forms_by_level', (
      select coalesce(jsonb_object_agg(forms.level, forms.form_count), '{}'::jsonb)
      from (
        select f.level::text as level, count(*)::integer as form_count
        from public.exam_forms f where f.status = 'published'
        group by f.level
      ) forms
    ),
    'questions_awaiting_review', case when actor_is_reviewer then (
      select count(*)::integer from public.questions q where q.status = 'needs_review'
    ) else null end,
    'active_attempts', case when actor_is_reviewer then (
      select count(*)::integer from public.exam_attempts a where a.status = 'in_progress'
    ) else null end,
    'open_support_tickets', case when actor_is_support_staff then (
      select count(*)::integer from public.support_tickets t where t.status in ('open', 'in_progress', 'waiting_for_student')
    ) else null end,
    'pending_payment_reviews', case when actor_is_payment_staff then (
      select count(*)::integer from public.payment_submissions p where p.status in ('pending', 'needs_review')
    ) else null end,
    'recent_audit_events', case when actor_is_admin then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'action', recent.action,
        'entity_type', recent.entity_type,
        'created_at', recent.created_at
      ) order by recent.created_at desc), '[]'::jsonb)
      from (
        select ae.action, ae.entity_type, ae.created_at
        from public.admin_audit_events ae order by ae.created_at desc limit 8
      ) recent
    ) else '[]'::jsonb end,
    'backup_status', 'not_verified'
  ) into summary;

  return summary;
end;
$$;

revoke all on function public.get_admin_dashboard_summary() from public, anon;
grant execute on function public.get_admin_dashboard_summary() to authenticated;
