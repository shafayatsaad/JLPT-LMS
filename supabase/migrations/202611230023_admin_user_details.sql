-- Read-only, audited account detail for the private administrator workspace.
-- Account suspension, recovery and complimentary entitlement actions remain
-- separate policy decisions and are intentionally not exposed here.

begin;

create or replace function public.get_admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  account_row record;
begin
  if actor_id is null or not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Administrator role required';
  end if;
  if p_user_id is null then raise exception 'Choose a valid account'; end if;

  select
    u.id,
    u.email::text as email,
    u.phone::text as phone,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.phone_confirmed_at,
    u.banned_until
  into account_row
  from auth.users u
  where u.id = p_user_id;
  if not found then raise exception 'The account is unavailable'; end if;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (
    actor_id,
    'user_detail.viewed',
    'user_account',
    p_user_id,
    jsonb_build_object('sections', jsonb_build_array('profile', 'roles', 'attempts', 'payments', 'entitlements', 'support', 'audit'))
  );

  return jsonb_build_object(
    'account', jsonb_build_object(
      'user_id', account_row.id,
      'email', account_row.email,
      'phone', account_row.phone,
      'registered_at', account_row.created_at,
      'last_sign_in_at', account_row.last_sign_in_at,
      'email_confirmed_at', account_row.email_confirmed_at,
      'phone_confirmed_at', account_row.phone_confirmed_at,
      'banned_until', account_row.banned_until,
      'state', case when account_row.banned_until > now() then 'suspended' else 'active' end
    ),
    'profile', (
      select jsonb_build_object(
        'display_name', p.display_name,
        'target_level', p.target_level,
        'explanation_language', p.explanation_language,
        'ui_language', p.ui_language,
        'updated_at', p.updated_at
      )
      from public.profiles p where p.user_id = p_user_id
    ),
    'roles', coalesce((
      select jsonb_agg(ur.role::text order by ur.role::text)
      from public.user_roles ur where ur.user_id = p_user_id
    ), '[]'::jsonb),
    'attempt_summary', (
      select jsonb_build_object(
        'total', count(*),
        'in_progress', count(*) filter (where ea.status = 'in_progress'),
        'submitted', count(*) filter (where ea.status = 'submitted'),
        'expired', count(*) filter (where ea.status = 'expired'),
        'raw_correct', coalesce(sum(er.raw_correct), 0),
        'raw_incorrect', coalesce(sum(er.raw_incorrect), 0),
        'raw_unanswered', coalesce(sum(er.raw_unanswered), 0)
      )
      from public.exam_attempts ea
      left join public.exam_results er on er.attempt_id = ea.id
      where ea.user_id = p_user_id
    ),
    'recent_attempts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', recent.id,
        'form_code', recent.form_code,
        'level', recent.level,
        'status', recent.status,
        'attempt_number', recent.attempt_number,
        'started_at', recent.started_at,
        'submitted_at', recent.submitted_at,
        'raw_correct', recent.raw_correct,
        'raw_incorrect', recent.raw_incorrect,
        'raw_unanswered', recent.raw_unanswered
      ) order by recent.sort_at desc), '[]'::jsonb)
      from (
        select
          ea.id,
          ef.form_code,
          ea.level::text as level,
          ea.status::text as status,
          ea.attempt_number,
          ea.started_at,
          ea.submitted_at,
          er.raw_correct,
          er.raw_incorrect,
          er.raw_unanswered,
          coalesce(ea.submitted_at, ea.started_at, ea.created_at) as sort_at
        from public.exam_attempts ea
        join public.exam_forms ef on ef.id = ea.exam_form_id
        left join public.exam_results er on er.attempt_id = ea.id
        where ea.user_id = p_user_id
        order by coalesce(ea.submitted_at, ea.started_at, ea.created_at) desc
        limit 25
      ) recent
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', recent.id,
        'provider', recent.provider,
        'payment_method', recent.payment_method,
        'amount', recent.amount,
        'currency', recent.currency,
        'status', recent.status,
        'submitted_at', recent.submitted_at,
        'reviewed_at', recent.reviewed_at,
        'plan', recent.plan_snapshot
      ) order by recent.submitted_at desc), '[]'::jsonb)
      from (
        select
          ps.id,
          ps.provider,
          ps.payment_method,
          ps.amount,
          ps.currency,
          case when ps.cancelled_at is not null then 'cancelled' else ps.status::text end as status,
          ps.submitted_at,
          ps.reviewed_at,
          ps.plan_snapshot
        from public.payment_submissions ps
        where ps.user_id = p_user_id
        order by ps.submitted_at desc
        limit 25
      ) recent
    ),
    'entitlements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', recent.id,
        'plan_code', recent.plan_code,
        'plan_name', recent.plan_name,
        'status', recent.status,
        'starts_at', recent.starts_at,
        'ends_at', recent.ends_at,
        'source_payment_submission_id', recent.source_payment_submission_id
      ) order by recent.created_at desc), '[]'::jsonb)
      from (
        select
          ue.id,
          pl.code as plan_code,
          pl.name as plan_name,
          ue.status::text as status,
          ue.starts_at,
          ue.ends_at,
          ue.source_payment_submission_id,
          ue.created_at
        from public.user_entitlements ue
        join public.plans pl on pl.id = ue.plan_id
        where ue.user_id = p_user_id
        order by ue.created_at desc
        limit 25
      ) recent
    ),
    'support_tickets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', recent.id,
        'category', recent.category,
        'subject', recent.subject,
        'status', recent.status,
        'created_at', recent.created_at,
        'updated_at', recent.updated_at
      ) order by recent.updated_at desc), '[]'::jsonb)
      from (
        select st.id, st.category, st.subject, st.status, st.created_at, st.updated_at
        from public.support_tickets st
        where st.user_id = p_user_id
        order by st.updated_at desc
        limit 25
      ) recent
    ),
    'audit_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'action', recent.action,
        'actor_user_id', recent.actor_user_id,
        'before_state', recent.before_state,
        'after_state', recent.after_state,
        'created_at', recent.created_at
      ) order by recent.created_at desc), '[]'::jsonb)
      from (
        select ae.action, ae.actor_user_id, ae.before_state, ae.after_state, ae.created_at
        from public.admin_audit_events ae
        where ae.entity_id = p_user_id
        order by ae.created_at desc
        limit 50
      ) recent
    )
  );
end;
$$;

revoke all on function public.get_admin_user_detail(uuid) from public, anon;
grant execute on function public.get_admin_user_detail(uuid) to authenticated;

commit;
