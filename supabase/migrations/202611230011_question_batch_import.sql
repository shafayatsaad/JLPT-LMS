-- Atomic JSON question batch import. Imported items are always drafts and
-- continue through the same independent content and rights review workflow.
-- Apply after migrations 001 through 010.

begin;

create or replace function public.create_question_drafts_batch(p_questions jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  item jsonb;
  question_data jsonb;
  answer_data jsonb;
  created_ids uuid[] := array[]::uuid[];
  created_question_id uuid;
  imported_count integer;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Import payload must be an array of questions';
  end if;
  imported_count := jsonb_array_length(p_questions);
  if imported_count < 1 or imported_count > 100 then
    raise exception 'Import between 1 and 100 questions at a time';
  end if;

  for item in select value from jsonb_array_elements(p_questions)
  loop
    question_data := coalesce(item -> 'question', item);
    answer_data := item -> 'answer_key';
    if answer_data is null or jsonb_typeof(question_data) <> 'object' then
      raise exception 'Each item needs a question object and answer_key object';
    end if;

    created_question_id := public.create_question_draft(
      nullif(question_data ->> 'content_key', '')::uuid,
      coalesce(nullif(question_data ->> 'revision', '')::integer, 1),
      (question_data ->> 'level')::public.jlpt_level,
      question_data ->> 'test_section_code',
      question_data ->> 'score_category_code',
      question_data ->> 'item_type_code',
      question_data -> 'prompt',
      question_data -> 'options',
      answer_data ->> 'correct_option_id',
      answer_data -> 'explanation',
      coalesce(answer_data -> 'distractor_rationales', '{}'::jsonb),
      nullif(question_data ->> 'difficulty_estimate', '')::smallint,
      coalesce(item ->> 'source_type', 'original'),
      item ->> 'source_reference',
      item ->> 'rights_notes'
    );
    created_ids := array_append(created_ids, created_question_id);
  end loop;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'question.batch_imported', 'question_batch',
    jsonb_build_object('count', imported_count, 'question_ids', to_jsonb(created_ids), 'status', 'draft'));
  return created_ids;
end;
$$;

revoke all on function public.create_question_drafts_batch(jsonb) from public, anon;
grant execute on function public.create_question_drafts_batch(jsonb) to authenticated;

commit;
