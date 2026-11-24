-- Rename the PL/pgSQL question variable so the ON CONFLICT target resolves to
-- the attempt_answers column instead of an ambiguous variable/column name.
begin;

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
  target_question_id uuid;
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
  target_question_id := (item_row ->> 'question_id')::uuid;

  if p_selected_option_id is not null and not exists (
    select 1 from jsonb_array_elements(item_row -> 'options') opt
    where opt.value ->> 'id' = p_selected_option_id
  ) then raise exception 'Choose one of the listed answer options'; end if;

  insert into public.attempt_answers (
    attempt_id, question_id, exam_form_item_id, selected_option_id, time_spent_seconds, saved_at
  ) values (
    p_attempt_id, target_question_id, item_id, p_selected_option_id, p_time_spent_seconds, saved_time
  ) on conflict (attempt_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        time_spent_seconds = excluded.time_spent_seconds,
        saved_at = excluded.saved_at;

  return saved_time;
end;
$$;

revoke all on function public.save_exam_answer(uuid, uuid, text, integer) from public, anon;
grant execute on function public.save_exam_answer(uuid, uuid, text, integer) to authenticated;

commit;
