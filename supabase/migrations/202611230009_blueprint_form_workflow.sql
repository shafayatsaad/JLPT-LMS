-- Audited blueprint authoring/review and exam form assembly/validation/publication.
-- Apply after migrations 001 through 008.

begin;

-- A blueprint editor submits a complete structural draft. Section durations are
-- stored per slot, then checked for consistency before a reviewer can approve it.
create or replace function public.create_exam_blueprint_draft(
  p_level public.jlpt_level,
  p_version integer,
  p_slots jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  blueprint_id uuid;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_version is null or p_version < 1 then raise exception 'Blueprint version must be positive'; end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'Add at least one blueprint slot';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_slots) slot(value)
    where coalesce((slot.value ->> 'slot_order')::integer, 0) < 1
      or length(trim(coalesce(slot.value ->> 'test_section_code', ''))) = 0
      or length(trim(coalesce(slot.value ->> 'score_category_code', ''))) = 0
      or length(trim(coalesce(slot.value ->> 'item_type_code', ''))) = 0
      or coalesce((slot.value ->> 'question_quota')::integer, 0) < 1
      or coalesce((slot.value ->> 'section_duration_seconds')::integer, 0) < 1
      or (slot.value ? 'required_asset_types' and jsonb_typeof(slot.value -> 'required_asset_types') <> 'array')
  ) then raise exception 'Every slot needs an order, section, category, item type, positive quota and duration'; end if;
  if (select count(*) from jsonb_array_elements(p_slots)) <>
     (select count(distinct (slot.value ->> 'slot_order')::integer) from jsonb_array_elements(p_slots) slot(value)) then
    raise exception 'Blueprint slot order values must be unique';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_slots) slot(value)
    group by slot.value ->> 'test_section_code'
    having min((slot.value ->> 'section_duration_seconds')::integer) <>
           max((slot.value ->> 'section_duration_seconds')::integer)
  ) then raise exception 'All slots in a section must use the same duration'; end if;

  insert into public.exam_blueprints (level, version, status, created_by)
  values (p_level, p_version, 'draft', actor_id)
  returning id into blueprint_id;

  insert into public.blueprint_slots (
    blueprint_id, slot_order, test_section_code, score_category_code,
    item_type_code, question_quota, difficulty_targets, required_asset_types,
    section_duration_seconds
  )
  select blueprint_id,
    (slot.value ->> 'slot_order')::integer,
    trim(slot.value ->> 'test_section_code'),
    trim(slot.value ->> 'score_category_code'),
    trim(slot.value ->> 'item_type_code'),
    (slot.value ->> 'question_quota')::integer,
    coalesce(slot.value -> 'difficulty_targets', '{}'::jsonb),
    array(select jsonb_array_elements_text(coalesce(slot.value -> 'required_asset_types', '[]'::jsonb))),
    (slot.value ->> 'section_duration_seconds')::integer
  from jsonb_array_elements(p_slots) slot(value)
  order by (slot.value ->> 'slot_order')::integer;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'exam_blueprint.draft_created', 'exam_blueprint', blueprint_id,
    jsonb_build_object('level', p_level, 'version', p_version, 'slot_count', jsonb_array_length(p_slots)));
  return blueprint_id;
end;
$$;

revoke all on function public.create_exam_blueprint_draft(public.jlpt_level, integer, jsonb) from public, anon;
grant execute on function public.create_exam_blueprint_draft(public.jlpt_level, integer, jsonb) to authenticated;

create or replace function public.update_exam_blueprint_draft_slots(p_blueprint_id uuid, p_slots jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  blueprint_row public.exam_blueprints%rowtype;
  previous_slot_count integer;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  select b.* into blueprint_row from public.exam_blueprints b
  where b.id = p_blueprint_id and b.created_by = actor_id for update;
  if not found or blueprint_row.status <> 'draft' then raise exception 'Only your own blueprint draft can be edited'; end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'Add at least one blueprint slot';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_slots) slot(value)
    where coalesce((slot.value ->> 'slot_order')::integer, 0) < 1
      or length(trim(coalesce(slot.value ->> 'test_section_code', ''))) = 0
      or length(trim(coalesce(slot.value ->> 'score_category_code', ''))) = 0
      or length(trim(coalesce(slot.value ->> 'item_type_code', ''))) = 0
      or coalesce((slot.value ->> 'question_quota')::integer, 0) < 1
      or coalesce((slot.value ->> 'section_duration_seconds')::integer, 0) < 1
      or (slot.value ? 'required_asset_types' and jsonb_typeof(slot.value -> 'required_asset_types') <> 'array')
  ) then raise exception 'Every slot needs an order, section, category, item type, positive quota and duration'; end if;
  if (select count(*) from jsonb_array_elements(p_slots)) <>
     (select count(distinct (slot.value ->> 'slot_order')::integer) from jsonb_array_elements(p_slots) slot(value)) then
    raise exception 'Blueprint slot order values must be unique';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_slots) slot(value)
    group by slot.value ->> 'test_section_code'
    having min((slot.value ->> 'section_duration_seconds')::integer) <>
           max((slot.value ->> 'section_duration_seconds')::integer)
  ) then raise exception 'All slots in a section must use the same duration'; end if;

  select count(*) into previous_slot_count from public.blueprint_slots s where s.blueprint_id = p_blueprint_id;
  delete from public.blueprint_slots where blueprint_id = p_blueprint_id;
  insert into public.blueprint_slots (
    blueprint_id, slot_order, test_section_code, score_category_code,
    item_type_code, question_quota, difficulty_targets, required_asset_types,
    section_duration_seconds
  )
  select p_blueprint_id, (slot.value ->> 'slot_order')::integer,
    trim(slot.value ->> 'test_section_code'), trim(slot.value ->> 'score_category_code'),
    trim(slot.value ->> 'item_type_code'), (slot.value ->> 'question_quota')::integer,
    coalesce(slot.value -> 'difficulty_targets', '{}'::jsonb),
    array(select jsonb_array_elements_text(coalesce(slot.value -> 'required_asset_types', '[]'::jsonb))),
    (slot.value ->> 'section_duration_seconds')::integer
  from jsonb_array_elements(p_slots) slot(value)
  order by (slot.value ->> 'slot_order')::integer;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'exam_blueprint.draft_updated', 'exam_blueprint', p_blueprint_id,
    jsonb_build_object('slot_count', previous_slot_count), jsonb_build_object('slot_count', jsonb_array_length(p_slots)));
  return p_blueprint_id;
end;
$$;

revoke all on function public.update_exam_blueprint_draft_slots(uuid, jsonb) from public, anon;
grant execute on function public.update_exam_blueprint_draft_slots(uuid, jsonb) to authenticated;

create or replace function public.submit_exam_blueprint_for_review(p_blueprint_id uuid)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  blueprint_row public.exam_blueprints%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  select b.* into blueprint_row from public.exam_blueprints b
  where b.id = p_blueprint_id and b.created_by = actor_id for update;
  if not found or blueprint_row.status <> 'draft' then raise exception 'Only your own blueprint draft can be submitted'; end if;
  if not exists (select 1 from public.blueprint_slots s where s.blueprint_id = p_blueprint_id) then
    raise exception 'A blueprint needs at least one slot';
  end if;
  if exists (
    select 1 from public.blueprint_slots s where s.blueprint_id = p_blueprint_id
    group by s.test_section_code
    having min(s.section_duration_seconds) <= 0 or min(s.section_duration_seconds) <> max(s.section_duration_seconds)
  ) then raise exception 'Each section needs one consistent positive duration'; end if;

  update public.exam_blueprints set status = 'needs_review' where id = p_blueprint_id;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'exam_blueprint.submitted_for_review', 'exam_blueprint', p_blueprint_id,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'needs_review'));
  return 'needs_review'::public.content_status;
end;
$$;

revoke all on function public.submit_exam_blueprint_for_review(uuid) from public, anon;
grant execute on function public.submit_exam_blueprint_for_review(uuid) to authenticated;

create or replace function public.get_exam_blueprint_review_queue()
returns table (
  id uuid,
  level public.jlpt_level,
  version integer,
  created_by uuid,
  created_at timestamptz,
  slots jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Reviewer role required';
  end if;
  return query
  select b.id, b.level, b.version, b.created_by, b.created_at,
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'slot_order', s.slot_order, 'test_section_code', s.test_section_code,
      'score_category_code', s.score_category_code, 'item_type_code', s.item_type_code,
      'question_quota', s.question_quota, 'required_asset_types', s.required_asset_types,
      'section_duration_seconds', s.section_duration_seconds, 'difficulty_targets', s.difficulty_targets
    ) order by s.slot_order) from public.blueprint_slots s where s.blueprint_id = b.id), '[]'::jsonb)
  from public.exam_blueprints b where b.status = 'needs_review'
  order by b.created_at asc limit 100;
end;
$$;

revoke all on function public.get_exam_blueprint_review_queue() from public, anon;
grant execute on function public.get_exam_blueprint_review_queue() to authenticated;

create or replace function public.review_exam_blueprint(
  p_blueprint_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  blueprint_row public.exam_blueprints%rowtype;
  next_status public.content_status;
begin
  if actor_id is null or not (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Reviewer role required';
  end if;
  if p_decision not in ('approved', 'rejected', 'needs_changes') then raise exception 'Unsupported blueprint decision'; end if;
  if length(coalesce(p_notes, '')) > 2000 then raise exception 'Review notes are limited to 2000 characters'; end if;
  select b.* into blueprint_row from public.exam_blueprints b where b.id = p_blueprint_id for update;
  if not found or blueprint_row.status <> 'needs_review' then raise exception 'Blueprint is not awaiting review'; end if;
  if blueprint_row.created_by = actor_id then raise exception 'Authors cannot review their own blueprints'; end if;
  if p_decision = 'approved' and (
    not exists (select 1 from public.blueprint_slots s where s.blueprint_id = p_blueprint_id)
    or exists (
      select 1 from public.blueprint_slots s where s.blueprint_id = p_blueprint_id
      group by s.test_section_code
      having min(s.section_duration_seconds) <= 0 or min(s.section_duration_seconds) <> max(s.section_duration_seconds)
    )
  ) then raise exception 'Blueprint slots and section durations must be complete before approval'; end if;
  next_status := case p_decision when 'approved' then 'approved'::public.content_status
    when 'rejected' then 'rejected'::public.content_status else 'draft'::public.content_status end;
  update public.exam_blueprints set status = next_status where id = p_blueprint_id;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'exam_blueprint.review.' || p_decision, 'exam_blueprint', p_blueprint_id,
    jsonb_build_object('status', blueprint_row.status), jsonb_build_object('status', next_status, 'notes', nullif(trim(p_notes), '')));
  return next_status;
end;
$$;

revoke all on function public.review_exam_blueprint(uuid, text, text) from public, anon;
grant execute on function public.review_exam_blueprint(uuid, text, text) to authenticated;

-- Form assembly only accepts approved questions and an approved matching
-- blueprint. The selected question IDs must meet every blueprint quota.
create or replace function public.create_exam_form_draft(
  p_blueprint_id uuid,
  p_form_code text,
  p_version integer,
  p_access_tier text,
  p_question_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  blueprint_row public.exam_blueprints%rowtype;
  form_id uuid;
  expected_count integer;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_access_tier not in ('free', 'premium') then raise exception 'Access tier must be free or premium'; end if;
  if p_access_tier = 'free' and not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Only an administrator can designate a form as free';
  end if;
  if p_version is null or p_version < 1 then raise exception 'Form version must be positive'; end if;
  if p_form_code is null or trim(p_form_code) !~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$' then
    raise exception 'Form code must be 3 to 64 letters, numbers, dashes or underscores';
  end if;
  select b.* into blueprint_row from public.exam_blueprints b
  where b.id = p_blueprint_id and b.status in ('approved', 'eligible_for_exam') for share;
  if not found then raise exception 'Choose an approved blueprint'; end if;
  select coalesce(sum(s.question_quota), 0)::integer into expected_count
  from public.blueprint_slots s where s.blueprint_id = p_blueprint_id;
  if expected_count < 1 or p_question_ids is null or cardinality(p_question_ids) <> expected_count then
    raise exception 'Select exactly the number of questions required by the blueprint (%)', expected_count;
  end if;
  if cardinality(p_question_ids) <> (select count(distinct selected.question_id) from unnest(p_question_ids) as selected(question_id)) then
    raise exception 'A question cannot appear more than once in a form';
  end if;
  if exists (
    select 1 from unnest(p_question_ids) selected(question_id)
    left join public.questions q on q.id = selected.question_id
    where q.id is null or q.level <> blueprint_row.level or q.status not in ('approved', 'eligible_for_exam')
      or not exists (
        select 1 from public.blueprint_slots s where s.blueprint_id = p_blueprint_id
          and s.test_section_code = q.test_section_code
          and s.score_category_code = q.score_category_code
          and s.item_type_code = q.item_type_code
      )
  ) then raise exception 'Every selected question must be approved and match the blueprint level and slot types'; end if;
  if exists (
    with expected as (
      select s.test_section_code, s.score_category_code, s.item_type_code, sum(s.question_quota)::integer as quota
      from public.blueprint_slots s where s.blueprint_id = p_blueprint_id
      group by s.test_section_code, s.score_category_code, s.item_type_code
    ), actual as (
      select q.test_section_code, q.score_category_code, q.item_type_code, count(*)::integer as item_count
      from unnest(p_question_ids) selected(question_id)
      join public.questions q on q.id = selected.question_id
      group by q.test_section_code, q.score_category_code, q.item_type_code
    )
    select 1 from expected e left join actual a using (test_section_code, score_category_code, item_type_code)
    where coalesce(a.item_count, 0) <> e.quota
  ) then raise exception 'Selected question counts do not match each blueprint slot'; end if;

  insert into public.exam_forms (blueprint_id, level, form_code, version, status, assembly_seed, manifest, is_frozen, created_by, access_tier)
  values (
    p_blueprint_id, blueprint_row.level, upper(trim(p_form_code)), p_version, 'draft',
    gen_random_uuid()::text,
    jsonb_build_object(
      'blueprint_id', p_blueprint_id,
      'blueprint_version', blueprint_row.version,
      'slots', (select jsonb_agg(jsonb_build_object(
        'slot_order', s.slot_order, 'test_section_code', s.test_section_code,
        'score_category_code', s.score_category_code, 'item_type_code', s.item_type_code,
        'question_quota', s.question_quota, 'section_duration_seconds', s.section_duration_seconds,
        'required_asset_types', s.required_asset_types
      ) order by s.slot_order) from public.blueprint_slots s where s.blueprint_id = p_blueprint_id)
    ), false, actor_id, p_access_tier
  ) returning id into form_id;
  insert into public.exam_form_items (exam_form_id, question_id, position)
  select form_id, selected.question_id, selected.ordinality::integer
  from unnest(p_question_ids) with ordinality selected(question_id, ordinality)
  order by selected.ordinality;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'exam_form.draft_created', 'exam_form', form_id,
    jsonb_build_object('blueprint_id', p_blueprint_id, 'level', blueprint_row.level,
      'form_code', upper(trim(p_form_code)), 'version', p_version, 'access_tier', p_access_tier,
      'question_count', cardinality(p_question_ids)));
  return form_id;
end;
$$;

revoke all on function public.create_exam_form_draft(uuid, text, integer, text, uuid[]) from public, anon;
grant execute on function public.create_exam_form_draft(uuid, text, integer, text, uuid[]) to authenticated;

create or replace function private.assert_exam_form_publishable(p_exam_form_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  form_row public.exam_forms%rowtype;
  invalid_sections integer;
begin
  select f.* into form_row from public.exam_forms f where f.id = p_exam_form_id;
  if not found then raise exception 'Exam form not found'; end if;
  if not exists (
    select 1 from public.exam_blueprints b
    where b.id = form_row.blueprint_id and b.level = form_row.level and b.status in ('approved', 'eligible_for_exam')
  ) then raise exception 'The form must use an approved blueprint for the same JLPT level'; end if;
  if not exists (select 1 from public.blueprint_slots s where s.blueprint_id = form_row.blueprint_id) then
    raise exception 'The approved blueprint has no slots';
  end if;

  if exists (
    with expected as (
      select s.test_section_code, s.score_category_code, s.item_type_code, sum(s.question_quota)::integer as quota
      from public.blueprint_slots s where s.blueprint_id = form_row.blueprint_id
      group by s.test_section_code, s.score_category_code, s.item_type_code
    ), actual as (
      select q.test_section_code, q.score_category_code, q.item_type_code, count(*)::integer as item_count
      from public.exam_form_items fi join public.questions q on q.id = fi.question_id
      where fi.exam_form_id = p_exam_form_id
      group by q.test_section_code, q.score_category_code, q.item_type_code
    )
    select 1 from expected e left join actual a using (test_section_code, score_category_code, item_type_code)
    where coalesce(a.item_count, 0) <> e.quota
  ) or exists (
    select 1 from public.exam_form_items fi
    left join public.questions q on q.id = fi.question_id
    where fi.exam_form_id = p_exam_form_id
      and (q.id is null or q.level <> form_row.level or q.status not in ('approved', 'eligible_for_exam')
        or not exists (
          select 1 from public.blueprint_slots s where s.blueprint_id = form_row.blueprint_id
            and s.test_section_code = q.test_section_code and s.score_category_code = q.score_category_code
            and s.item_type_code = q.item_type_code
        ))
  ) then raise exception 'The form must meet every approved blueprint quota using approved questions'; end if;

  if exists (
    select 1 from public.exam_form_items fi
    join public.questions q on q.id = fi.question_id
    left join public.question_answer_keys ak on ak.question_id = q.id
    where fi.exam_form_id = p_exam_form_id and (ak.question_id is null or not exists (
      select 1 from jsonb_array_elements(q.options) option_row(value)
      where option_row.value ->> 'id' = ak.correct_option_id
    ))
  ) then raise exception 'Every form question needs a valid reviewed answer key'; end if;

  if exists (
    select 1
    from public.blueprint_slots s
    cross join lateral unnest(s.required_asset_types) required(asset_type)
    join public.exam_form_items fi on fi.exam_form_id = p_exam_form_id
    join public.questions q on q.id = fi.question_id
      and q.test_section_code = s.test_section_code
      and q.score_category_code = s.score_category_code
      and q.item_type_code = s.item_type_code
    where s.blueprint_id = form_row.blueprint_id
      and not exists (
        select 1 from public.question_assets qa join public.content_assets ca on ca.id = qa.asset_id
        where qa.question_id = q.id and ca.status in ('approved', 'eligible_for_exam')
          and (lower(ca.media_type) = lower(required.asset_type)
            or split_part(lower(ca.media_type), '/', 1) = lower(required.asset_type))
      )
  ) then raise exception 'A required approved image or audio asset is missing'; end if;

  select count(*) into invalid_sections from (
    select s.test_section_code, min(s.section_duration_seconds) as minimum_duration,
      max(s.section_duration_seconds) as maximum_duration
    from public.blueprint_slots s where s.blueprint_id = form_row.blueprint_id
    group by s.test_section_code
  ) sections where sections.minimum_duration <= 0 or sections.minimum_duration <> sections.maximum_duration;
  if invalid_sections > 0 then raise exception 'Each exam section needs one consistent positive duration'; end if;
end;
$$;

revoke all on function private.assert_exam_form_publishable(uuid) from public, anon, authenticated;

create or replace function public.validate_exam_form(p_exam_form_id uuid, p_notes text default null)
returns public.form_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  form_row public.exam_forms%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Reviewer role required';
  end if;
  if length(coalesce(p_notes, '')) > 2000 then raise exception 'Review notes are limited to 2000 characters'; end if;
  select f.* into form_row from public.exam_forms f where f.id = p_exam_form_id for update;
  if not found or form_row.status <> 'draft' or form_row.is_frozen then raise exception 'Only an unfrozen draft can be validated'; end if;
  if form_row.created_by = actor_id then raise exception 'Form authors cannot validate their own forms'; end if;
  perform private.assert_exam_form_publishable(p_exam_form_id);
  update public.exam_forms set status = 'validated' where id = p_exam_form_id;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'exam_form.validated', 'exam_form', p_exam_form_id,
    jsonb_build_object('status', form_row.status), jsonb_build_object('status', 'validated', 'notes', nullif(trim(p_notes), '')));
  return 'validated'::public.form_status;
end;
$$;

revoke all on function public.validate_exam_form(uuid, text) from public, anon;
grant execute on function public.validate_exam_form(uuid, text) to authenticated;

create or replace function public.publish_exam_form(p_exam_form_id uuid, p_notes text default null)
returns public.form_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  form_row public.exam_forms%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Reviewer role required';
  end if;
  if length(coalesce(p_notes, '')) > 2000 then raise exception 'Review notes are limited to 2000 characters'; end if;
  select f.* into form_row from public.exam_forms f where f.id = p_exam_form_id for update;
  if not found or form_row.status <> 'validated' or form_row.is_frozen then raise exception 'Only a validated, unfrozen form can be published'; end if;
  if form_row.created_by = actor_id then raise exception 'Form authors cannot publish their own forms'; end if;
  perform private.assert_exam_form_publishable(p_exam_form_id);
  update public.exam_forms
  set status = 'published', is_frozen = true, published_at = clock_timestamp()
  where id = p_exam_form_id;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'exam_form.published', 'exam_form', p_exam_form_id,
    jsonb_build_object('status', form_row.status, 'is_frozen', form_row.is_frozen),
    jsonb_build_object('status', 'published', 'is_frozen', true, 'access_tier', form_row.access_tier,
      'published_at', clock_timestamp(), 'notes', nullif(trim(p_notes), '')));
  return 'published'::public.form_status;
end;
$$;

revoke all on function public.publish_exam_form(uuid, text) from public, anon;
grant execute on function public.publish_exam_form(uuid, text) to authenticated;

-- Ensure review decisions cannot be combined with edits to a form's access tier
-- or publication timestamp.
create or replace function private.protect_review_decisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status::text is distinct from new.status::text
    and old.status::text in ('needs_review', 'draft')
    and new.status::text in ('approved', 'eligible_for_exam', 'rejected', 'validated', 'draft')
    and (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role]))
  then
    if tg_table_name = 'exam_blueprints'
      and row(new.level, new.version, new.created_by) is distinct from row(old.level, old.version, old.created_by)
    then raise exception 'Review decisions cannot edit blueprint fields';
    elsif tg_table_name = 'exam_forms'
      and row(new.blueprint_id, new.level, new.form_code, new.version, new.assembly_seed, new.manifest,
        new.is_frozen, new.created_by, new.access_tier, new.published_at)
        is distinct from row(old.blueprint_id, old.level, old.form_code, old.version, old.assembly_seed, old.manifest,
        old.is_frozen, old.created_by, old.access_tier, old.published_at)
    then raise exception 'Validation decisions cannot edit exam form fields';
    elsif tg_table_name = 'questions'
      and row(new.content_key, new.revision, new.level, new.test_section_code, new.score_category_code,
        new.item_type_code, new.difficulty_estimate, new.stimulus_group_id, new.prompt, new.options, new.authored_by)
        is distinct from row(old.content_key, old.revision, old.level, old.test_section_code, old.score_category_code,
        old.item_type_code, old.difficulty_estimate, old.stimulus_group_id, old.prompt, old.options, old.authored_by)
    then raise exception 'Review decisions cannot edit authored question fields';
    elsif tg_table_name = 'passage_groups'
      and row(new.content_key, new.revision, new.level, new.group_type, new.content, new.authored_by)
        is distinct from row(old.content_key, old.revision, old.level, old.group_type, old.content, old.authored_by)
    then raise exception 'Review decisions cannot edit authored passage fields';
    elsif tg_table_name = 'content_assets'
      and row(new.storage_path, new.media_type, new.checksum_sha256, new.duration_seconds, new.created_at)
        is distinct from row(old.storage_path, old.media_type, old.checksum_sha256, old.duration_seconds, old.created_at)
    then raise exception 'Asset review decisions cannot edit asset metadata';
  end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_review_decisions() from public, anon, authenticated;

-- State changes must go through the audited RPCs. Editors may still adjust
-- authored rows while they remain drafts, but cannot submit by changing status
-- directly through table updates.
drop policy if exists "questions: editor update draft" on public.questions;
create policy "questions: editor update draft"
  on public.questions for update to authenticated
  using (
    authored_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    authored_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "passages: editor update draft" on public.passage_groups;
create policy "passages: editor update draft"
  on public.passage_groups for update to authenticated
  using (
    authored_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    authored_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "assets: editor update draft" on public.content_assets;
create policy "assets: editor update draft"
  on public.content_assets for update to authenticated
  using (
    status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "blueprints: editor manage drafts" on public.exam_blueprints;
create policy "blueprints: editor manage drafts"
  on public.exam_blueprints for all to authenticated
  using (
    created_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    created_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

commit;
