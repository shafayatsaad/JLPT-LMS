-- Add curated skill tags during manual and batch question authoring.
-- Apply after migrations 001 through 013.

begin;

create or replace function public.set_question_draft_skill_tags(
  p_question_id uuid,
  p_tag_slugs text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  question_row public.questions%rowtype;
  tag_slug text;
  tag_id uuid;
  saved_count integer := 0;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_tag_slugs is null or cardinality(p_tag_slugs) > 8 then
    raise exception 'Provide at most eight skill tags';
  end if;

  select q.* into question_row from public.questions q
  where q.id = p_question_id and q.authored_by = actor_id and q.status = 'draft'
  for update;
  if not found then raise exception 'Only your own question draft can be tagged'; end if;

  if exists (
    select 1 from unnest(p_tag_slugs) supplied(value)
    where supplied.value is null
      or lower(trim(supplied.value)) !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ) then
    raise exception 'Skill tags must use lowercase letters, numbers and single hyphens';
  end if;
  if cardinality(p_tag_slugs) <> (select count(distinct lower(trim(value))) from unnest(p_tag_slugs) as input(value)) then
    raise exception 'Skill tags must be unique';
  end if;

  delete from public.question_tags qt where qt.question_id = p_question_id;
  foreach tag_slug in array p_tag_slugs loop
    tag_slug := lower(trim(tag_slug));
    insert into public.tags (slug, label, tag_type)
    values (tag_slug, initcap(replace(tag_slug, '-', ' ')), 'skill')
    on conflict (slug) do nothing;

    select t.id into tag_id from public.tags t where t.slug = tag_slug and t.tag_type = 'skill';
    if not found then raise exception 'The tag slug is already used by a non-skill tag'; end if;

    insert into public.question_tags (question_id, tag_id) values (p_question_id, tag_id);
    saved_count := saved_count + 1;
  end loop;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'question.skill_tags_updated', 'question', p_question_id,
    jsonb_build_object('tag_slugs', to_jsonb(p_tag_slugs), 'count', saved_count));
  return saved_count;
end;
$$;

revoke all on function public.set_question_draft_skill_tags(uuid, text[]) from public, anon;
grant execute on function public.set_question_draft_skill_tags(uuid, text[]) to authenticated;

create or replace function private.require_question_skill_tag_before_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'needs_review'
    and not exists (select 1 from public.question_tags qt where qt.question_id = new.id)
  then
    raise exception 'Add at least one skill tag before submitting a question for review';
  end if;
  return new;
end;
$$;

revoke all on function private.require_question_skill_tag_before_submission() from public, anon, authenticated;
drop trigger if exists question_skill_tag_required_before_submission on public.questions;
create trigger question_skill_tag_required_before_submission
  before update of status on public.questions
  for each row execute function private.require_question_skill_tag_before_submission();

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
  tags_data jsonb;
  tag_values text[];
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
    tags_data := coalesce(item -> 'tags', question_data -> 'tags');
    if tags_data is null or jsonb_typeof(tags_data) <> 'array' then
      raise exception 'Each item needs a skill tag array';
    end if;
    if jsonb_array_length(tags_data) < 1 or jsonb_array_length(tags_data) > 8 then
      raise exception 'Each item needs one to eight skill tags';
    end if;
    select array_agg(tag_value) into tag_values
    from jsonb_array_elements_text(tags_data) as tags(tag_value);

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
    perform public.set_question_draft_skill_tags(created_question_id, tag_values);
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
