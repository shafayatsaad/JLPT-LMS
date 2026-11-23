-- Admin/reviewer-only read-only attempt operations monitor. Does not return answers.
-- Apply after migration 025 and only after reconciling the hosted migration ledger.

create or replace function public.get_admin_attempt_monitor(
  p_status text default null,
  p_search text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  status_value text := nullif(trim(coalesce(p_status, '')), '');
  search_value text := nullif(trim(coalesce(p_search, '')), '');
  result_json jsonb;
  result_count integer;
begin
  if actor_id is null or not (select private.has_any_role(array[
    'admin'::public.app_role,
    'reviewer'::public.app_role
  ])) then
    raise exception 'Exam operations access is required';
  end if;
  if status_value is not null and status_value not in ('created', 'in_progress', 'submitted', 'expired') then
    raise exception 'Attempt status filter is invalid';
  end if;
  if length(coalesce(search_value, '')) > 120 then raise exception 'Search text is too long'; end if;

  select coalesce(jsonb_agg(to_jsonb(page_row) order by page_row.created_at desc), '[]'::jsonb), count(*)::integer
  into result_json, result_count
  from (
    select
      a.id as attempt_id,
      a.user_id,
      p.display_name as learner_name,
      f.id as exam_form_id,
      f.form_code,
      a.level::text as level,
      a.status::text as status,
      a.attempt_number,
      a.created_at,
      a.started_at,
      a.deadline_at,
      a.submitted_at,
      (select count(*)::integer from public.attempt_sections s where s.attempt_id = a.id) as section_count,
      (select count(*)::integer from public.attempt_sections s where s.attempt_id = a.id and s.status = 'completed') as completed_sections,
      (select s.section_code from public.attempt_sections s where s.attempt_id = a.id and s.status = 'active' order by s.section_order limit 1) as active_section,
      (select count(*)::integer from public.attempt_answers aa where aa.attempt_id = a.id and aa.selected_option_id is not null) as answered_count,
      (select count(*)::integer from public.exam_form_items fi where fi.exam_form_id = f.id) as form_item_count
    from public.exam_attempts a
    join public.exam_forms f on f.id = a.exam_form_id
    left join public.profiles p on p.user_id = a.user_id
    where (status_value is null or a.status::text = status_value)
      and (
        search_value is null
        or f.form_code ilike '%' || search_value || '%'
        or a.user_id::text = search_value
        or coalesce(p.display_name, '') ilike '%' || search_value || '%'
      )
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
  ) as page_row;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'attempt_monitor.viewed', 'exam_attempt', jsonb_build_object(
    'status_filter', status_value,
    'search_supplied', search_value is not null,
    'row_count', result_count
  ));

  return result_json;
end;
$$;

revoke all on function public.get_admin_attempt_monitor(text, text, integer) from public, anon;
grant execute on function public.get_admin_attempt_monitor(text, text, integer) to authenticated;
