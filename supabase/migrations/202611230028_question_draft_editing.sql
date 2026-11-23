-- Audited author-only editing for unsubmitted question drafts.
-- A question revision becomes immutable after it leaves draft.

create or replace function public.get_question_draft_for_edit(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  question_row public.questions%rowtype;
  answer_row public.question_answer_keys%rowtype;
  actor_is_admin boolean;
begin
  if actor_id is null or not (select private.has_any_role(array[
    'content_editor'::public.app_role,
    'admin'::public.app_role
  ])) then
    raise exception 'Content editor role required';
  end if;
  actor_is_admin := (select private.has_role('admin'::public.app_role));

  select * into question_row from public.questions where id = p_question_id;
  if not found or question_row.status <> 'draft'
    or (question_row.authored_by <> actor_id and not actor_is_admin)
  then
    raise exception 'This draft is unavailable for editing';
  end if;
  select * into answer_row from public.question_answer_keys where question_id = p_question_id;
  if not found then raise exception 'The draft answer key is unavailable'; end if;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'question.draft_edit_opened', 'question', p_question_id,
    jsonb_build_object('status', question_row.status, 'revision', question_row.revision));

  return jsonb_build_object(
    'question', to_jsonb(question_row),
    'answer_key', jsonb_build_object(
      'correct_option_id', answer_row.correct_option_id,
      'explanation', answer_row.explanation,
      'distractor_rationales', answer_row.distractor_rationales
    )
  );
end;
$$;

create or replace function public.update_question_draft(
  p_question_id uuid,
  p_level public.jlpt_level,
  p_test_section_code text,
  p_score_category_code text,
  p_item_type_code text,
  p_prompt jsonb,
  p_options jsonb,
  p_correct_option_id text,
  p_explanation jsonb,
  p_distractor_rationales jsonb,
  p_difficulty_estimate smallint,
  p_source_type text,
  p_source_reference text,
  p_rights_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  question_row public.questions%rowtype;
  option_count integer;
  distinct_option_count integer;
  answer_update_count integer;
  actor_is_admin boolean;
begin
  if actor_id is null or not (select private.has_any_role(array[
    'content_editor'::public.app_role,
    'admin'::public.app_role
  ])) then
    raise exception 'Content editor role required';
  end if;
  if p_level is null then raise exception 'Choose a JLPT level'; end if;
  if length(trim(coalesce(p_test_section_code, ''))) not between 1 and 80
    or length(trim(coalesce(p_score_category_code, ''))) not between 1 and 80
    or length(trim(coalesce(p_item_type_code, ''))) not between 1 and 80
  then raise exception 'Section, score category and item type are required'; end if;
  if p_prompt is null or jsonb_typeof(p_prompt) <> 'array' or jsonb_array_length(p_prompt) = 0
    or pg_column_size(p_prompt) > 65536
  then raise exception 'Prompt must be a non-empty content array under 64 KB'; end if;
  if p_options is null or jsonb_typeof(p_options) <> 'array'
    or jsonb_array_length(p_options) < 2 or jsonb_array_length(p_options) > 20
    or pg_column_size(p_options) > 65536
  then raise exception 'Options must be an array of 2 to 20 choices under 64 KB'; end if;
  if p_explanation is null or jsonb_typeof(p_explanation) <> 'object' or pg_column_size(p_explanation) > 16384
    or p_distractor_rationales is null or jsonb_typeof(p_distractor_rationales) <> 'object' or pg_column_size(p_distractor_rationales) > 16384
  then raise exception 'Explanation and distractor notes must be JSON objects under 16 KB'; end if;
  if p_difficulty_estimate is not null and p_difficulty_estimate not between 1 and 5 then
    raise exception 'Difficulty must be between 1 and 5';
  end if;
  if p_source_type is null or p_source_type not in ('original', 'licensed', 'public_domain', 'permission_granted') then
    raise exception 'Unsupported content source type';
  end if;
  if length(coalesce(p_source_reference, '')) > 500 or length(coalesce(p_rights_notes, '')) > 2000 then
    raise exception 'Source reference or rights notes exceed the allowed length';
  end if;
  if p_source_type <> 'original' and (
    length(trim(coalesce(p_source_reference, ''))) = 0
    or length(trim(coalesce(p_rights_notes, ''))) = 0
  ) then raise exception 'Licensed or third-party content needs a source reference and rights notes'; end if;

  select count(*), count(distinct option_row.value ->> 'id')
    into option_count, distinct_option_count
  from jsonb_array_elements(p_options) as option_row(value);
  if option_count <> distinct_option_count or exists (
    select 1 from jsonb_array_elements(p_options) as option_row(value)
    where length(trim(coalesce(option_row.value ->> 'id', ''))) = 0
  ) then raise exception 'Each answer option must have a unique non-empty ID'; end if;
  if nullif(trim(coalesce(p_correct_option_id, '')), '') is null or not exists (
    select 1 from jsonb_array_elements(p_options) as option_row(value)
    where option_row.value ->> 'id' = p_correct_option_id
  ) then raise exception 'The correct answer must match one listed option'; end if;

  actor_is_admin := (select private.has_role('admin'::public.app_role));
  select * into question_row
  from public.questions
  where id = p_question_id
  for update;
  if not found or question_row.status <> 'draft'
    or (question_row.authored_by <> actor_id and not actor_is_admin)
  then raise exception 'Only the author or an administrator may update this draft'; end if;

  update public.questions
  set level = p_level,
      test_section_code = trim(p_test_section_code),
      score_category_code = trim(p_score_category_code),
      item_type_code = trim(p_item_type_code),
      prompt = p_prompt,
      options = p_options,
      difficulty_estimate = p_difficulty_estimate,
      source_type = p_source_type,
      source_reference = nullif(trim(p_source_reference), ''),
      rights_notes = nullif(trim(p_rights_notes), '')
  where id = p_question_id;

  update public.question_answer_keys
  set correct_option_id = trim(p_correct_option_id),
      explanation = p_explanation,
      distractor_rationales = p_distractor_rationales
  where question_id = p_question_id;
  get diagnostics answer_update_count = row_count;
  if answer_update_count <> 1 then raise exception 'The draft answer key is unavailable'; end if;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'question.draft_updated', 'question', p_question_id,
    jsonb_build_object('status', 'draft', 'level', question_row.level,
      'test_section_code', question_row.test_section_code, 'score_category_code', question_row.score_category_code,
      'item_type_code', question_row.item_type_code, 'source_type', question_row.source_type),
    jsonb_build_object('status', 'draft', 'level', p_level,
      'test_section_code', trim(p_test_section_code), 'score_category_code', trim(p_score_category_code),
      'item_type_code', trim(p_item_type_code), 'source_type', p_source_type));

  return jsonb_build_object('id', p_question_id, 'updated', true, 'status', 'draft');
end;
$$;

revoke all on function public.get_question_draft_for_edit(uuid) from public, anon;
revoke all on function public.update_question_draft(uuid, public.jlpt_level, text, text, text, jsonb, jsonb, text, jsonb, jsonb, smallint, text, text, text) from public, anon;
grant execute on function public.get_question_draft_for_edit(uuid) to authenticated;
grant execute on function public.update_question_draft(uuid, public.jlpt_level, text, text, text, jsonb, jsonb, text, jsonb, jsonb, smallint, text, text, text) to authenticated;
