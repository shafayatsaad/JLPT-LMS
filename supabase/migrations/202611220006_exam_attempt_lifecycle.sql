-- Authenticated, server-timed exam attempts over published frozen forms.
-- Apply after 202611220001 through 202611220005.

begin;

-- New forms default to premium access. Editors may designate specific reviewed
-- introductory forms as free. Premium plans use the `published_full_mocks`
-- feature key in plans.features.
alter table public.exam_forms
  add column if not exists access_tier text not null default 'premium'
  check (access_tier in ('free', 'premium'));

alter table public.exam_attempts
  add column if not exists start_request_key uuid;

create unique index if not exists exam_attempts_user_request_key_unique
  on public.exam_attempts (user_id, start_request_key)
  where start_request_key is not null;

create unique index if not exists exam_attempts_one_active_per_user
  on public.exam_attempts (user_id)
  where status = 'in_progress';

alter table public.attempt_answers
  add column if not exists is_flagged boolean not null default false;

-- Private asset authorization is tied to the learner's own live section or a
-- completed attempt. Storage paths alone do not grant access.
create or replace function private.can_read_exam_asset(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.content_assets ca
    join public.question_assets qa on qa.asset_id = ca.id
    join public.exam_attempts a on a.user_id = (select auth.uid())
      and a.status in ('in_progress', 'submitted', 'expired')
    cross join lateral jsonb_array_elements(a.form_snapshot -> 'items') item
    where ca.storage_path = p_storage_path
      and ca.status in ('approved', 'eligible_for_exam')
      and qa.question_id = (item.value ->> 'question_id')::uuid
      and (
        a.status in ('submitted', 'expired')
        or exists (
          select 1
          from public.attempt_sections s
          where s.attempt_id = a.id
            and s.status = 'active'
            and s.deadline_at > now()
            and s.section_code = item.value ->> 'section_code'
        )
      )
  );
$$;

revoke all on function private.can_read_exam_asset(text) from public, anon;
grant execute on function private.can_read_exam_asset(text) to authenticated;

drop policy if exists "JLPT learners read assets in own attempts" on storage.objects;
create policy "JLPT learners read assets in own attempts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'jlpt-question-assets'
    and (select private.can_read_exam_asset(name))
  );

-- Finalization grades exactly once, stores only platform raw counts, updates
-- learner statistics, and closes the attempt in the same transaction.
create or replace function private.finalize_exam_attempt(
  p_attempt_id uuid,
  p_actor_id uuid,
  p_expired boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.exam_attempts%rowtype;
  correct_total integer;
  incorrect_total integer;
  unanswered_total integer;
  section_totals jsonb;
  category_totals jsonb;
  close_time timestamptz := clock_timestamp();
begin
  select a.* into attempt_row
  from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = p_actor_id
  for update;

  if not found or attempt_row.status <> 'in_progress' then
    return;
  end if;

  if p_expired and (attempt_row.deadline_at is null or attempt_row.deadline_at > close_time) then
    raise exception 'The exam deadline has not passed';
  end if;

  update public.attempt_answers aa
  set graded_correct = (aa.selected_option_id = ak.correct_option_id)
  from public.question_answer_keys ak
  where aa.attempt_id = p_attempt_id
    and ak.question_id = aa.question_id;

  with scored_items as (
    select
      item.value ->> 'section_code' as section_code,
      item.value ->> 'score_category_code' as score_category_code,
      aa.selected_option_id,
      ak.correct_option_id
    from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
    left join public.attempt_answers aa
      on aa.attempt_id = p_attempt_id
      and aa.exam_form_item_id = (item.value ->> 'form_item_id')::uuid
    left join public.question_answer_keys ak
      on ak.question_id = (item.value ->> 'question_id')::uuid
  )
  select
    count(*) filter (where selected_option_id is not null and selected_option_id = correct_option_id)::integer,
    count(*) filter (where selected_option_id is not null and selected_option_id <> correct_option_id)::integer,
    count(*) filter (where selected_option_id is null)::integer
  into correct_total, incorrect_total, unanswered_total
  from scored_items;

  with scored_items as (
    select
      item.value ->> 'section_code' as section_code,
      item.value ->> 'score_category_code' as score_category_code,
      aa.selected_option_id,
      ak.correct_option_id
    from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
    left join public.attempt_answers aa
      on aa.attempt_id = p_attempt_id
      and aa.exam_form_item_id = (item.value ->> 'form_item_id')::uuid
    left join public.question_answer_keys ak
      on ak.question_id = (item.value ->> 'question_id')::uuid
  ), section_rows as (
    select section_code,
      count(*) filter (where selected_option_id is not null and selected_option_id = correct_option_id)::integer as correct,
      count(*) filter (where selected_option_id is not null and selected_option_id <> correct_option_id)::integer as incorrect,
      count(*) filter (where selected_option_id is null)::integer as unanswered
    from scored_items group by section_code
  )
  select coalesce(jsonb_object_agg(section_code, jsonb_build_object(
    'correct', correct, 'incorrect', incorrect, 'unanswered', unanswered
  )), '{}'::jsonb) into section_totals from section_rows;

  with scored_items as (
    select
      item.value ->> 'score_category_code' as score_category_code,
      aa.selected_option_id,
      ak.correct_option_id
    from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
    left join public.attempt_answers aa
      on aa.attempt_id = p_attempt_id
      and aa.exam_form_item_id = (item.value ->> 'form_item_id')::uuid
    left join public.question_answer_keys ak
      on ak.question_id = (item.value ->> 'question_id')::uuid
  ), category_rows as (
    select score_category_code,
      count(*) filter (where selected_option_id is not null and selected_option_id = correct_option_id)::integer as correct,
      count(*) filter (where selected_option_id is not null and selected_option_id <> correct_option_id)::integer as incorrect,
      count(*) filter (where selected_option_id is null)::integer as unanswered
    from scored_items group by score_category_code
  )
  select coalesce(jsonb_object_agg(score_category_code, jsonb_build_object(
    'correct', correct, 'incorrect', incorrect, 'unanswered', unanswered
  )), '{}'::jsonb) into category_totals from category_rows;

  insert into public.exam_results (
    attempt_id, raw_correct, raw_incorrect, raw_unanswered,
    section_breakdown, score_category_breakdown, grading_version, graded_at
  ) values (
    p_attempt_id, coalesce(correct_total, 0), coalesce(incorrect_total, 0), coalesce(unanswered_total, 0),
    coalesce(section_totals, '{}'::jsonb), coalesce(category_totals, '{}'::jsonb), 'raw-v1', close_time
  ) on conflict (attempt_id) do nothing;

  insert into public.user_question_stats (user_id, question_id, times_seen, correct_count, last_seen_at)
  select
    attempt_row.user_id,
    (item.value ->> 'question_id')::uuid,
    1,
    case when aa.selected_option_id = ak.correct_option_id then 1 else 0 end,
    close_time
  from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
  left join public.attempt_answers aa
    on aa.attempt_id = p_attempt_id
    and aa.exam_form_item_id = (item.value ->> 'form_item_id')::uuid
  join public.question_answer_keys ak
    on ak.question_id = (item.value ->> 'question_id')::uuid
  on conflict (user_id, question_id) do update
    set times_seen = public.user_question_stats.times_seen + 1,
        correct_count = public.user_question_stats.correct_count + excluded.correct_count,
        last_seen_at = excluded.last_seen_at;

  update public.attempt_sections
  set status = case
        when status = 'active' and not p_expired then 'completed'::public.section_status
        else 'expired'::public.section_status
      end,
      completed_at = coalesce(completed_at, close_time)
  where attempt_id = p_attempt_id and status in ('active', 'locked');

  update public.exam_attempts
  set status = case when p_expired then 'expired'::public.attempt_status else 'submitted'::public.attempt_status end,
      submitted_at = close_time
  where id = p_attempt_id and status = 'in_progress';
end;
$$;

revoke all on function private.finalize_exam_attempt(uuid, uuid, boolean) from public, anon, authenticated;

-- Move past timed-out sections using the previous section's server deadline,
-- not the time of a reconnect, so an offline learner cannot gain extra time.
create or replace function private.catch_up_exam_sections(p_attempt_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.exam_attempts%rowtype;
  active_row public.attempt_sections%rowtype;
  next_row public.attempt_sections%rowtype;
  prior_order integer := 0;
  scheduled_start timestamptz;
  scheduled_deadline timestamptz;
  now_at timestamptz := clock_timestamp();
begin
  select a.* into attempt_row
  from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = p_actor_id
  for update;
  if not found or attempt_row.status <> 'in_progress' then return; end if;

  loop
    select s.* into active_row
    from public.attempt_sections s
    where s.attempt_id = p_attempt_id and s.status = 'active'
    order by s.section_order
    limit 1
    for update;

    if found then
      if active_row.deadline_at > now_at then return; end if;
      prior_order := active_row.section_order;
      scheduled_start := active_row.deadline_at;
      update public.attempt_sections
      set status = 'expired', completed_at = active_row.deadline_at
      where id = active_row.id;
    else
      select s.section_order, s.completed_at into prior_order, scheduled_start
      from public.attempt_sections s
      where s.attempt_id = p_attempt_id and s.status in ('completed', 'expired')
      order by s.section_order desc limit 1;
      if not found then
        prior_order := 0;
        scheduled_start := attempt_row.started_at;
      end if;
    end if;

    select s.* into next_row
    from public.attempt_sections s
    where s.attempt_id = p_attempt_id and s.status = 'locked' and s.section_order > prior_order
    order by s.section_order
    limit 1
    for update;

    if not found then
      if attempt_row.deadline_at <= now_at then
        perform private.finalize_exam_attempt(p_attempt_id, p_actor_id, true);
      end if;
      return;
    end if;

    scheduled_deadline := scheduled_start + (next_row.duration_seconds * interval '1 second');
    if scheduled_deadline <= now_at then
      update public.attempt_sections
      set status = 'expired', started_at = scheduled_start,
          deadline_at = scheduled_deadline, completed_at = scheduled_deadline
      where id = next_row.id;
      prior_order := next_row.section_order;
      scheduled_start := scheduled_deadline;
    else
      update public.attempt_sections
      set status = 'active', started_at = scheduled_start, deadline_at = scheduled_deadline
      where id = next_row.id;
      return;
    end if;
  end loop;
end;
$$;

revoke all on function private.catch_up_exam_sections(uuid, uuid) from public, anon, authenticated;

create or replace function public.start_exam_attempt(p_exam_form_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  form_row public.exam_forms%rowtype;
  existing_attempt public.exam_attempts%rowtype;
  new_attempt_id uuid;
  next_attempt_number integer;
  invalid_sections integer;
  total_duration_seconds bigint;
  start_time timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sign in before starting an exam'; end if;
  if p_idempotency_key is null then raise exception 'An idempotency key is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));

  select a.* into existing_attempt
  from public.exam_attempts a
  where a.user_id = actor_id and a.start_request_key = p_idempotency_key;
  if found then return existing_attempt.id; end if;

  select a.* into existing_attempt
  from public.exam_attempts a
  where a.user_id = actor_id and a.status = 'in_progress'
  order by a.created_at desc limit 1
  for update;
  if found then
    if existing_attempt.exam_form_id = p_exam_form_id then return existing_attempt.id; end if;
    raise exception 'Finish or submit your active exam before starting another';
  end if;

  select f.* into form_row
  from public.exam_forms f
  where f.id = p_exam_form_id and f.status = 'published' and f.is_frozen;
  if not found then raise exception 'This exam is not published'; end if;
  if not exists (
    select 1 from public.exam_blueprints b
    where b.id = form_row.blueprint_id
      and b.level = form_row.level
      and b.status in ('approved', 'eligible_for_exam')
  ) then
    raise exception 'The exam form must use an approved blueprint for the same JLPT level';
  end if;

  if form_row.access_tier = 'premium' and not exists (
    select 1
    from public.user_entitlements ue
    join public.plans p on p.id = ue.plan_id
    where ue.user_id = actor_id
      and ue.status = 'active'
      and ue.starts_at <= start_time
      and ue.ends_at > start_time
      and p.features ->> 'published_full_mocks' = 'true'
  ) then
    raise exception 'Premium access is required for this exam';
  end if;

  if exists (
    with required_slots as (
      select bs.test_section_code, bs.score_category_code, bs.item_type_code,
        sum(bs.question_quota)::integer as question_quota
      from public.blueprint_slots bs
      where bs.blueprint_id = form_row.blueprint_id
      group by bs.test_section_code, bs.score_category_code, bs.item_type_code
    ), actual_slots as (
      select q.test_section_code, q.score_category_code, q.item_type_code, count(*)::integer as item_count
      from public.exam_form_items fi
      join public.questions q on q.id = fi.question_id
      where fi.exam_form_id = p_exam_form_id
      group by q.test_section_code, q.score_category_code, q.item_type_code
    )
    select 1 from required_slots required
    left join actual_slots actual using (test_section_code, score_category_code, item_type_code)
    where coalesce(actual.item_count, 0) <> required.question_quota
  ) or exists (
    select 1 from public.exam_form_items fi
    join public.questions q on q.id = fi.question_id
    where fi.exam_form_id = p_exam_form_id
      and (q.level <> form_row.level or not exists (
        select 1 from public.blueprint_slots bs
        where bs.blueprint_id = form_row.blueprint_id
          and bs.test_section_code = q.test_section_code
          and bs.score_category_code = q.score_category_code
          and bs.item_type_code = q.item_type_code
      ))
  ) then
    raise exception 'The published exam must match the blueprint question quotas and JLPT level';
  end if;

  if exists (
    select 1 from public.exam_form_items fi
    join public.questions q on q.id = fi.question_id
    left join public.question_answer_keys ak on ak.question_id = q.id
    where fi.exam_form_id = p_exam_form_id
      and (ak.question_id is null or not exists (
        select 1 from jsonb_array_elements(q.options) opt
        where opt.value ->> 'id' = ak.correct_option_id
      ))
  ) then
    raise exception 'Every exam question needs a valid reviewed answer key';
  end if;

  if exists (
    select 1
    from public.blueprint_slots bs
    cross join lateral unnest(bs.required_asset_types) as required(asset_type)
    join public.exam_form_items fi on fi.exam_form_id = p_exam_form_id
    join public.questions q on q.id = fi.question_id
      and q.test_section_code = bs.test_section_code
      and q.score_category_code = bs.score_category_code
      and q.item_type_code = bs.item_type_code
    where bs.blueprint_id = form_row.blueprint_id
      and not exists (
        select 1
        from public.question_assets qa
        join public.content_assets ca on ca.id = qa.asset_id
        where qa.question_id = q.id
          and ca.status in ('approved', 'eligible_for_exam')
          and (
            lower(ca.media_type) = lower(required.asset_type)
            or split_part(lower(ca.media_type), '/', 1) = lower(required.asset_type)
          )
      )
  ) then
    raise exception 'A required exam question image or audio asset is missing';
  end if;

  select count(*) into invalid_sections
  from (
    select bs.test_section_code,
      min(bs.section_duration_seconds) as minimum_duration,
      max(bs.section_duration_seconds) as maximum_duration
    from public.blueprint_slots bs
    where bs.blueprint_id = form_row.blueprint_id
    group by bs.test_section_code
  ) sections
  where sections.minimum_duration <= 0 or sections.minimum_duration <> sections.maximum_duration;
  if invalid_sections > 0 then
    raise exception 'Each exam section must have one consistent positive duration';
  end if;

  select sum(section_duration_seconds)::bigint into total_duration_seconds
  from (
    select max(bs.section_duration_seconds) as section_duration_seconds
    from public.blueprint_slots bs
    where bs.blueprint_id = form_row.blueprint_id
    group by bs.test_section_code
  ) durations;
  if coalesce(total_duration_seconds, 0) <= 0 then raise exception 'The exam has no valid section timing'; end if;

  select coalesce(max(a.attempt_number), 0) + 1 into next_attempt_number
  from public.exam_attempts a
  where a.user_id = actor_id and a.exam_form_id = p_exam_form_id;

  insert into public.exam_attempts (
    user_id, exam_form_id, level, status, attempt_number,
    started_at, deadline_at, start_request_key
  ) values (
    actor_id, p_exam_form_id, form_row.level, 'in_progress', next_attempt_number,
    start_time, start_time + (total_duration_seconds * interval '1 second'), p_idempotency_key
  ) returning id into new_attempt_id;

  insert into public.attempt_sections (attempt_id, section_code, section_order, status, duration_seconds, started_at, deadline_at)
  select new_attempt_id, section_code, section_order,
    case when section_order = 1 then 'active'::public.section_status else 'locked'::public.section_status end,
    duration_seconds,
    case when section_order = 1 then start_time else null end,
    case when section_order = 1 then start_time + (duration_seconds * interval '1 second') else null end
  from (
    select bs.test_section_code as section_code,
      row_number() over (order by min(bs.slot_order))::integer as section_order,
      max(bs.section_duration_seconds) as duration_seconds
    from public.blueprint_slots bs
    where bs.blueprint_id = form_row.blueprint_id
    group by bs.test_section_code
  ) section_rows
  order by section_order;

  return new_attempt_id;
end;
$$;

revoke all on function public.start_exam_attempt(uuid, uuid) from public, anon;
grant execute on function public.start_exam_attempt(uuid, uuid) to authenticated;

create or replace function public.save_exam_answer(
  p_attempt_id uuid,
  p_form_item_id uuid,
  p_selected_option_id text,
  p_time_spent_seconds integer default 0
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
  active_section public.attempt_sections%rowtype;
  item_row jsonb;
  item_id uuid;
  question_id uuid;
  saved_time timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sign in before saving an answer'; end if;
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found then raise exception 'Exam attempt was not found'; end if;
  if attempt_row.status <> 'in_progress' then raise exception 'This exam attempt is already closed'; end if;

  perform private.catch_up_exam_sections(p_attempt_id, actor_id);
  select a.* into attempt_row from public.exam_attempts a where a.id = p_attempt_id;
  if attempt_row.status <> 'in_progress' then raise exception 'The exam deadline has passed'; end if;
  select s.* into active_section from public.attempt_sections s
  where s.attempt_id = p_attempt_id and s.status = 'active' for update;
  if not found or active_section.deadline_at <= saved_time then raise exception 'This section has ended'; end if;
  if p_time_spent_seconds < 0 or p_time_spent_seconds > 86400 then raise exception 'Invalid question time'; end if;

  select item.value into item_row
  from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
  where (item.value ->> 'form_item_id')::uuid = p_form_item_id
    and item.value ->> 'section_code' = active_section.section_code;
  if not found then raise exception 'Question is not in the active section'; end if;
  item_id := (item_row ->> 'form_item_id')::uuid;
  question_id := (item_row ->> 'question_id')::uuid;

  if p_selected_option_id is not null and not exists (
    select 1 from jsonb_array_elements(item_row -> 'options') opt
    where opt.value ->> 'id' = p_selected_option_id
  ) then raise exception 'Choose one of the listed answer options'; end if;

  insert into public.attempt_answers (
    attempt_id, question_id, exam_form_item_id, selected_option_id, time_spent_seconds, saved_at
  ) values (
    p_attempt_id, question_id, item_id, p_selected_option_id, p_time_spent_seconds, saved_time
  ) on conflict (attempt_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        time_spent_seconds = excluded.time_spent_seconds,
        saved_at = excluded.saved_at;

  return saved_time;
end;
$$;

revoke all on function public.save_exam_answer(uuid, uuid, text, integer) from public, anon;
grant execute on function public.save_exam_answer(uuid, uuid, text, integer) to authenticated;

create or replace function public.set_exam_answer_flag(
  p_attempt_id uuid,
  p_form_item_id uuid,
  p_is_flagged boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
  active_section public.attempt_sections%rowtype;
  item_row jsonb;
  question_id uuid;
begin
  if actor_id is null then raise exception 'Sign in before flagging a question'; end if;
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found or attempt_row.status <> 'in_progress' then raise exception 'Exam attempt is not active'; end if;
  perform private.catch_up_exam_sections(p_attempt_id, actor_id);
  select a.* into attempt_row from public.exam_attempts a where a.id = p_attempt_id;
  if attempt_row.status <> 'in_progress' then raise exception 'Exam attempt is closed'; end if;
  select s.* into active_section from public.attempt_sections s
  where s.attempt_id = p_attempt_id and s.status = 'active' for update;
  if not found or active_section.deadline_at <= clock_timestamp() then raise exception 'This section has ended'; end if;

  select item.value into item_row
  from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
  where (item.value ->> 'form_item_id')::uuid = p_form_item_id
    and item.value ->> 'section_code' = active_section.section_code;
  if not found then raise exception 'Question is not in the active section'; end if;
  question_id := (item_row ->> 'question_id')::uuid;

  insert into public.attempt_answers (attempt_id, question_id, exam_form_item_id, is_flagged)
  values (p_attempt_id, question_id, p_form_item_id, p_is_flagged)
  on conflict (attempt_id, question_id) do update set is_flagged = excluded.is_flagged;
  return p_is_flagged;
end;
$$;

revoke all on function public.set_exam_answer_flag(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_exam_answer_flag(uuid, uuid, boolean) to authenticated;

create or replace function public.advance_exam_section(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
  active_section public.attempt_sections%rowtype;
  next_section public.attempt_sections%rowtype;
  now_at timestamptz := clock_timestamp();
  next_deadline timestamptz;
  remaining_seconds bigint;
  timed_out_before_advance boolean := false;
begin
  if actor_id is null then raise exception 'Sign in before changing sections'; end if;
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found then raise exception 'Exam attempt was not found'; end if;
  if attempt_row.status <> 'in_progress' then
    return jsonb_build_object('status', attempt_row.status, 'section_advanced', false);
  end if;

  select s.* into active_section from public.attempt_sections s
  where s.attempt_id = p_attempt_id and s.status = 'active' for update;
  if found and active_section.deadline_at <= now_at then
    timed_out_before_advance := true;
    perform private.catch_up_exam_sections(p_attempt_id, actor_id);
    select a.* into attempt_row from public.exam_attempts a where a.id = p_attempt_id;
    select s.* into active_section from public.attempt_sections s
    where s.attempt_id = p_attempt_id and s.status = 'active' for update;
    if attempt_row.status <> 'in_progress' or not found then
      return jsonb_build_object('status', attempt_row.status, 'section_advanced', false);
    end if;
    if timed_out_before_advance then
      return jsonb_build_object('status', attempt_row.status, 'section_advanced', true, 'section_code', active_section.section_code);
    end if;
  end if;

  if not found then
    return jsonb_build_object('status', attempt_row.status, 'section_advanced', false);
  end if;

  update public.attempt_sections
  set status = 'completed', completed_at = now_at
  where id = active_section.id;

  select s.* into next_section from public.attempt_sections s
  where s.attempt_id = p_attempt_id and s.status = 'locked'
  order by s.section_order limit 1 for update;

  if not found then
    return jsonb_build_object('status', 'in_progress', 'section_advanced', true, 'finished_sections', true);
  end if;

  next_deadline := now_at + (next_section.duration_seconds * interval '1 second');
  update public.attempt_sections
  set status = 'active', started_at = now_at, deadline_at = next_deadline
  where id = next_section.id;

  select coalesce(sum(s.duration_seconds), 0) into remaining_seconds
  from public.attempt_sections s
  where s.attempt_id = p_attempt_id and s.section_order >= next_section.section_order;
  update public.exam_attempts
  set deadline_at = now_at + (remaining_seconds * interval '1 second')
  where id = p_attempt_id;

  return jsonb_build_object('status', 'in_progress', 'section_advanced', true, 'section_code', next_section.section_code);
end;
$$;

revoke all on function public.advance_exam_section(uuid) from public, anon;
grant execute on function public.advance_exam_section(uuid) to authenticated;

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
begin
  if actor_id is null then raise exception 'Sign in before submitting an exam'; end if;
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found then raise exception 'Exam attempt was not found'; end if;
  if attempt_row.status <> 'in_progress' then return p_attempt_id; end if;

  perform private.catch_up_exam_sections(p_attempt_id, actor_id);
  select a.* into attempt_row from public.exam_attempts a where a.id = p_attempt_id;
  if attempt_row.status = 'in_progress' then
    perform private.finalize_exam_attempt(p_attempt_id, actor_id, false);
  end if;
  return p_attempt_id;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;

create or replace function public.get_exam_attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attempt_row public.exam_attempts%rowtype;
  active_section public.attempt_sections%rowtype;
  sections_json jsonb;
  questions_json jsonb;
  assets_json jsonb;
begin
  if actor_id is null then raise exception 'Sign in to access this exam'; end if;
  select a.* into attempt_row from public.exam_attempts a
  where a.id = p_attempt_id and a.user_id = actor_id for update;
  if not found then raise exception 'Exam attempt was not found'; end if;
  if attempt_row.status = 'in_progress' then
    perform private.catch_up_exam_sections(p_attempt_id, actor_id);
    select a.* into attempt_row from public.exam_attempts a where a.id = p_attempt_id;
  end if;

  select s.* into active_section from public.attempt_sections s
  where s.attempt_id = p_attempt_id and s.status = 'active' limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'section_code', s.section_code,
    'section_order', s.section_order,
    'status', s.status,
    'deadline_at', s.deadline_at,
    'duration_seconds', s.duration_seconds
  ) order by s.section_order), '[]'::jsonb)
  into sections_json
  from public.attempt_sections s where s.attempt_id = p_attempt_id;

  if active_section.id is not null then
    select coalesce(jsonb_agg(
      item.value || jsonb_build_object(
        'selected_option_id', aa.selected_option_id,
        'is_flagged', coalesce(aa.is_flagged, false)
      ) order by (item.value ->> 'position')::integer
    ), '[]'::jsonb)
    into questions_json
    from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
    left join public.attempt_answers aa
      on aa.attempt_id = p_attempt_id
      and aa.exam_form_item_id = (item.value ->> 'form_item_id')::uuid
    where item.value ->> 'section_code' = active_section.section_code;

    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id', qa.question_id,
      'purpose', qa.purpose,
      'media_type', ca.media_type,
      'storage_path', ca.storage_path,
      'duration_seconds', ca.duration_seconds
    )), '[]'::jsonb)
    into assets_json
    from public.question_assets qa
    join public.content_assets ca on ca.id = qa.asset_id
    where ca.status in ('approved', 'eligible_for_exam')
      and exists (
        select 1 from jsonb_array_elements(attempt_row.form_snapshot -> 'items') item
        where (item.value ->> 'question_id')::uuid = qa.question_id
          and item.value ->> 'section_code' = active_section.section_code
      );
  else
    questions_json := '[]'::jsonb;
    assets_json := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', attempt_row.id,
      'level', attempt_row.level,
      'status', attempt_row.status,
      'started_at', attempt_row.started_at,
      'deadline_at', attempt_row.deadline_at,
      'submitted_at', attempt_row.submitted_at,
      'form_code', attempt_row.form_snapshot ->> 'form_code',
      'version', attempt_row.form_snapshot ->> 'version'
    ),
    'active_section', case when active_section.id is null then null else jsonb_build_object(
      'section_code', active_section.section_code,
      'section_order', active_section.section_order,
      'deadline_at', active_section.deadline_at,
      'duration_seconds', active_section.duration_seconds
    ) end,
    'sections', sections_json,
    'questions', questions_json,
    'assets', assets_json
  );
end;
$$;

revoke all on function public.get_exam_attempt_payload(uuid) from public, anon;
grant execute on function public.get_exam_attempt_payload(uuid) to authenticated;

commit;
