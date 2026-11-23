-- A private, filterable mistake notebook derived from completed exam attempts.
-- Learners explicitly mark a mistake reviewed; a later wrong answer reopens it.
-- Apply after migrations 001 through 015.

begin;

create table public.user_question_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  review_count integer not null default 1 check (review_count > 0),
  primary key (user_id, question_id)
);

create index user_question_reviews_question_idx
  on public.user_question_reviews (question_id, reviewed_at desc);

alter table public.user_question_reviews enable row level security;
revoke all on public.user_question_reviews from anon, authenticated;

create or replace function public.get_my_mistake_notebook(
  p_level public.jlpt_level default null,
  p_tag_slug text default null,
  p_item_type_code text default null,
  p_from date default null,
  p_to date default null,
  p_timezone text default 'Asia/Dhaka',
  p_reviewed boolean default false,
  p_limit integer default 100
)
returns table (
  question_id uuid,
  attempt_id uuid,
  level public.jlpt_level,
  test_section_code text,
  item_type_code text,
  prompt jsonb,
  options jsonb,
  selected_option_id text,
  correct_option_id text,
  explanation jsonb,
  distractor_rationales jsonb,
  wrong_at timestamptz,
  times_wrong bigint,
  tag_slugs text[],
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  timezone_name text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Dhaka');
begin
  if actor_id is null then raise exception 'Sign in to view your mistake notebook'; end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'The start of the date range must be before its end';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = timezone_name) then
    raise exception 'Choose a valid time zone';
  end if;

  return query
  with wrong_history as (
    select
      a.id as source_attempt_id,
      q.id as source_question_id,
      q.level as source_level,
      q.test_section_code as source_section,
      q.item_type_code as source_item_type,
      q.prompt as source_prompt,
      q.options as source_options,
      aa.selected_option_id as source_selected_option,
      ak.correct_option_id as source_correct_option,
      ak.explanation as source_explanation,
      ak.distractor_rationales as source_distractor_rationales,
      a.submitted_at as source_wrong_at,
      count(*) over (partition by q.id) as source_times_wrong,
      row_number() over (
        partition by q.id
        order by a.submitted_at desc nulls last, aa.saved_at desc, a.id desc
      ) as source_row_number
    from public.exam_attempts a
    join public.exam_form_items fi on fi.exam_form_id = a.exam_form_id
    join public.questions q on q.id = fi.question_id
    join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
    join public.question_answer_keys ak on ak.question_id = q.id
    where a.user_id = actor_id
      and a.status in ('submitted'::public.attempt_status, 'expired'::public.attempt_status)
      and aa.graded_correct is false
      and aa.selected_option_id is not null
      and (p_level is null or q.level = p_level)
      and (nullif(trim(coalesce(p_item_type_code, '')), '') is null or lower(q.item_type_code) = lower(trim(p_item_type_code)))
      and (nullif(trim(coalesce(p_tag_slug, '')), '') is null or exists (
        select 1
        from public.question_tags matched_qt
        join public.tags matched_tag on matched_tag.id = matched_qt.tag_id
        where matched_qt.question_id = q.id
          and matched_tag.tag_type = 'skill'
          and matched_tag.slug = lower(trim(p_tag_slug))
      ))
  ), latest_wrong as (
    select * from wrong_history where source_row_number = 1
  ), selected_mistakes as (
    select latest.*, review.reviewed_at as source_reviewed_at
    from latest_wrong latest
    left join public.user_question_reviews review
      on review.user_id = actor_id and review.question_id = latest.source_question_id
    where (p_from is null or latest.source_wrong_at >= (p_from::timestamp at time zone timezone_name))
      and (p_to is null or latest.source_wrong_at < ((p_to + 1)::timestamp at time zone timezone_name))
      and (p_reviewed is null or (review.reviewed_at is not null and review.reviewed_at >= latest.source_wrong_at) = p_reviewed)
  )
  select
    mistake.source_question_id,
    mistake.source_attempt_id,
    mistake.source_level,
    mistake.source_section,
    mistake.source_item_type,
    mistake.source_prompt,
    mistake.source_options,
    mistake.source_selected_option,
    mistake.source_correct_option,
    mistake.source_explanation,
    mistake.source_distractor_rationales,
    mistake.source_wrong_at,
    mistake.source_times_wrong,
    coalesce(tag_list.slugs, array[]::text[]),
    mistake.source_reviewed_at
  from selected_mistakes mistake
  left join lateral (
    select array_agg(t.slug order by t.slug) as slugs
    from public.question_tags qt
    join public.tags t on t.id = qt.tag_id and t.tag_type = 'skill'
    where qt.question_id = mistake.source_question_id
  ) tag_list on true
  order by mistake.source_wrong_at desc nulls last, mistake.source_question_id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

revoke all on function public.get_my_mistake_notebook(public.jlpt_level, text, text, date, date, text, boolean, integer) from public, anon;
grant execute on function public.get_my_mistake_notebook(public.jlpt_level, text, text, date, date, text, boolean, integer) to authenticated;

create or replace function public.set_my_mistake_reviewed(p_question_id uuid, p_reviewed boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  review_time timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sign in to update your mistake notebook'; end if;
  if p_question_id is null or p_reviewed is null then raise exception 'A question and review state are required'; end if;

  if not exists (
    select 1
    from public.exam_attempts a
    join public.exam_form_items fi on fi.exam_form_id = a.exam_form_id
    join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = fi.question_id
    where a.user_id = actor_id
      and fi.question_id = p_question_id
      and a.status in ('submitted'::public.attempt_status, 'expired'::public.attempt_status)
      and aa.graded_correct is false
      and aa.selected_option_id is not null
  ) then raise exception 'Only a question missed in a completed attempt can be updated here'; end if;

  if p_reviewed then
    insert into public.user_question_reviews (user_id, question_id, reviewed_at, review_count)
    values (actor_id, p_question_id, review_time, 1)
    on conflict (user_id, question_id) do update
      set reviewed_at = excluded.reviewed_at,
          review_count = public.user_question_reviews.review_count + 1
    returning public.user_question_reviews.reviewed_at into review_time;
    return review_time;
  end if;

  delete from public.user_question_reviews
  where user_id = actor_id and question_id = p_question_id;
  return null;
end;
$$;

revoke all on function public.set_my_mistake_reviewed(uuid, boolean) from public, anon;
grant execute on function public.set_my_mistake_reviewed(uuid, boolean) to authenticated;

comment on table public.user_question_reviews is
  'Learner-owned review markers for previously missed questions; a later miss reopens the item.';

commit;
