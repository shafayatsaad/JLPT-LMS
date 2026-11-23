-- Audited draft question creation and reviewer-visible content queue.
-- Apply after migrations 001 through 006.

begin;

alter table public.questions
  add column if not exists source_type text not null default 'original'
    check (source_type in ('original', 'licensed', 'public_domain', 'permission_granted')),
  add column if not exists source_reference text,
  add column if not exists rights_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_source_rights_documented'
  ) then
    alter table public.questions
      add constraint questions_source_rights_documented check (
        status not in ('needs_review', 'approved', 'eligible_for_exam')
        or source_type = 'original'
        or (
          length(trim(coalesce(source_reference, ''))) > 0
          and length(trim(coalesce(rights_notes, ''))) > 0
        )
      );
  end if;
end;
$$;

-- Extend the existing approved-revision guard to protect provenance metadata.
create or replace function public.prevent_approved_question_mutation()
returns trigger
language plpgsql
as $$
declare
  question_id_to_check uuid;
  current_status public.content_status;
begin
  if tg_table_name = 'questions' then
    question_id_to_check := coalesce(new.id, old.id);
    current_status := old.status;
    if current_status in ('approved', 'eligible_for_exam', 'retired') then
      if tg_op = 'DELETE' or row(
        new.content_key, new.revision, new.level, new.test_section_code, new.score_category_code,
        new.item_type_code, new.difficulty_estimate, new.stimulus_group_id, new.prompt,
        new.options, new.authored_by, new.source_type, new.source_reference, new.rights_notes
      ) is distinct from row(
        old.content_key, old.revision, old.level, old.test_section_code, old.score_category_code,
        old.item_type_code, old.difficulty_estimate, old.stimulus_group_id, old.prompt,
        old.options, old.authored_by, old.source_type, old.source_reference, old.rights_notes
      ) then
        raise exception 'Approved question revisions are immutable';
      end if;
    end if;
  else
    question_id_to_check := coalesce(new.question_id, old.question_id);
    select status into current_status from public.questions where id = question_id_to_check;
    if current_status in ('approved', 'eligible_for_exam', 'retired') then
      if tg_op = 'DELETE' or row(new.correct_option_id, new.explanation)
        is distinct from row(old.correct_option_id, old.explanation) then
        raise exception 'Approved question answer keys are immutable';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.create_question_draft(
  p_content_key uuid,
  p_revision integer,
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
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_question_id uuid;
  option_count integer;
  distinct_option_count integer;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_content_key is null then raise exception 'A question-family UUID is required'; end if;
  if p_revision is null or p_revision < 1 then raise exception 'Revision must be a positive integer'; end if;
  if length(trim(coalesce(p_test_section_code, ''))) = 0
    or length(trim(coalesce(p_score_category_code, ''))) = 0
    or length(trim(coalesce(p_item_type_code, ''))) = 0
  then raise exception 'Section, score category and item type are required'; end if;
  if p_prompt is null or jsonb_typeof(p_prompt) <> 'array' then
    raise exception 'Prompt must be an array of content blocks';
  end if;
  if jsonb_array_length(p_prompt) = 0 then raise exception 'Prompt cannot be empty'; end if;
  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'Answer options must be an array';
  end if;
  if jsonb_array_length(p_options) < 2 then raise exception 'At least two answer options are required'; end if;
  if jsonb_typeof(p_explanation) <> 'object' then raise exception 'Explanation must be a JSON object'; end if;
  if p_distractor_rationales is null or jsonb_typeof(p_distractor_rationales) <> 'object' then
    raise exception 'Distractor rationales must be a JSON object';
  end if;
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
  ) then
    raise exception 'Licensed or third-party content needs a source reference and rights notes';
  end if;

  select count(*), count(distinct option_row.value ->> 'id')
    into option_count, distinct_option_count
  from jsonb_array_elements(p_options) as option_row(value);
  if option_count <> distinct_option_count or exists (
    select 1 from jsonb_array_elements(p_options) as option_row(value)
    where length(trim(coalesce(option_row.value ->> 'id', ''))) = 0
  ) then
    raise exception 'Each answer option must have a unique non-empty ID';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_options) as option_row(value)
    where option_row.value ->> 'id' = p_correct_option_id
  ) then raise exception 'The correct answer must match one listed option'; end if;

  insert into public.questions (
    content_key, revision, level, test_section_code, score_category_code,
    item_type_code, difficulty_estimate, prompt, options, status, authored_by,
    source_type, source_reference, rights_notes
  ) values (
    p_content_key, p_revision, p_level, trim(p_test_section_code), trim(p_score_category_code),
    trim(p_item_type_code), p_difficulty_estimate, p_prompt, p_options, 'draft', actor_id,
    p_source_type, nullif(trim(p_source_reference), ''), nullif(trim(p_rights_notes), '')
  ) returning id into created_question_id;

  insert into public.question_answer_keys (question_id, correct_option_id, explanation, distractor_rationales)
  values (created_question_id, p_correct_option_id, p_explanation, p_distractor_rationales);

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (
    actor_id, 'question.draft_created', 'question', created_question_id,
    jsonb_build_object('status', 'draft', 'level', p_level, 'source_type', p_source_type)
  );
  return created_question_id;
end;
$$;

revoke all on function public.create_question_draft(uuid, integer, public.jlpt_level, text, text, text, jsonb, jsonb, text, jsonb, jsonb, smallint, text, text, text) from public, anon;
grant execute on function public.create_question_draft(uuid, integer, public.jlpt_level, text, text, text, jsonb, jsonb, text, jsonb, jsonb, smallint, text, text, text) to authenticated;

create or replace function public.submit_question_for_review(p_question_id uuid)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  question_row public.questions%rowtype;
  answer_key public.question_answer_keys%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  select q.* into question_row
  from public.questions q
  where q.id = p_question_id and q.authored_by = actor_id
  for update;
  if not found or question_row.status <> 'draft' then raise exception 'Only your own draft can be submitted'; end if;
  select ak.* into answer_key from public.question_answer_keys ak where ak.question_id = p_question_id;
  if not found or not exists (
    select 1 from jsonb_array_elements(question_row.options) option_row(value)
    where option_row.value ->> 'id' = answer_key.correct_option_id
  ) then raise exception 'A valid answer key is required before review'; end if;
  if question_row.source_type <> 'original' and (
    length(trim(coalesce(question_row.source_reference, ''))) = 0
    or length(trim(coalesce(question_row.rights_notes, ''))) = 0
  ) then raise exception 'Content provenance and usage rights must be documented'; end if;

  update public.questions set status = 'needs_review' where id = p_question_id;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (
    actor_id, 'question.submitted_for_review', 'question', p_question_id,
    jsonb_build_object('status', question_row.status), jsonb_build_object('status', 'needs_review')
  );
  return 'needs_review'::public.content_status;
end;
$$;

revoke all on function public.submit_question_for_review(uuid) from public, anon;
grant execute on function public.submit_question_for_review(uuid) to authenticated;

create or replace function public.get_question_review_queue()
returns table (
  id uuid,
  level public.jlpt_level,
  test_section_code text,
  score_category_code text,
  item_type_code text,
  prompt jsonb,
  options jsonb,
  correct_option_id text,
  explanation jsonb,
  distractor_rationales jsonb,
  source_type text,
  source_reference text,
  rights_notes text,
  authored_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role]))
  then raise exception 'Content reviewer role required'; end if;

  return query
  select q.id, q.level, q.test_section_code, q.score_category_code, q.item_type_code,
    q.prompt, q.options, ak.correct_option_id, ak.explanation, ak.distractor_rationales,
    q.source_type, q.source_reference, q.rights_notes, q.authored_by, q.created_at
  from public.questions q
  join public.question_answer_keys ak on ak.question_id = q.id
  where q.status = 'needs_review'
  order by q.created_at asc
  limit 100;
end;
$$;

revoke all on function public.get_question_review_queue() from public, anon;
grant execute on function public.get_question_review_queue() to authenticated;

commit;
