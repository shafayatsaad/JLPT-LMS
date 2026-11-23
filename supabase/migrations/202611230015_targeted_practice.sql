-- Secure, resumable targeted-practice sessions over approved text questions.
-- Practice reveals answer keys only after submission, like the mock-exam review flow.
-- Apply after migrations 001 through 014.

begin;

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level public.jlpt_level not null,
  tag_slug text not null references public.tags(slug) on update cascade on delete restrict,
  request_key uuid not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  question_count smallint not null default 5 check (question_count = 5),
  raw_correct smallint,
  raw_incorrect smallint,
  raw_unanswered smallint,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (user_id, request_key),
  check (
    (status = 'in_progress' and submitted_at is null and raw_correct is null)
    or (status = 'submitted' and submitted_at is not null and raw_correct is not null
      and raw_incorrect is not null and raw_unanswered is not null)
  )
);

create table public.practice_session_items (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position smallint not null check (position > 0),
  selected_option_id text,
  graded_correct boolean,
  saved_at timestamptz,
  primary key (session_id, question_id),
  unique (session_id, position)
);

create index practice_sessions_user_recent_idx
  on public.practice_sessions (user_id, created_at desc);

alter table public.practice_sessions enable row level security;
alter table public.practice_session_items enable row level security;
revoke all on public.practice_sessions, public.practice_session_items from anon, authenticated;

create or replace function private.is_targeted_practice_question(
  p_question_id uuid,
  p_level public.jlpt_level
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.questions q
    join public.question_answer_keys ak on ak.question_id = q.id
    where q.id = p_question_id
      and q.level = p_level
      and q.status in ('approved', 'eligible_for_exam')
      and q.test_section_code <> 'listening'
      and exists (
        select 1 from jsonb_array_elements(q.options) opt
        where opt.value ->> 'id' = ak.correct_option_id
      )
      and not exists (
        select 1 from public.question_assets qa where qa.question_id = q.id
      )
      and not exists (
        select 1 from jsonb_array_elements(q.prompt) block(value)
        where block.value ->> 'type' in ('audio', 'image')
      )
      and not exists (
        select 1
        from jsonb_array_elements(q.options) opt(value)
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(opt.value -> 'content') = 'array'
            then opt.value -> 'content' else '[]'::jsonb end
        ) block(value)
        where block.value ->> 'type' in ('audio', 'image')
      )
  );
$$;

revoke all on function private.is_targeted_practice_question(uuid, public.jlpt_level) from public, anon, authenticated;

create or replace function public.list_targeted_practice_tags()
returns table (
  level public.jlpt_level,
  tag_slug text,
  tag_label text,
  question_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Sign in to browse targeted practice'; end if;
  return query
  select q.level, t.slug, t.label, count(q.id)::bigint
  from public.tags t
  join public.question_tags qt on qt.tag_id = t.id
  join public.questions q on q.id = qt.question_id
  where t.tag_type = 'skill'
    and private.is_targeted_practice_question(q.id, q.level)
  group by q.level, t.slug, t.label
  having count(q.id) >= 5
  order by q.level, t.label;
end;
$$;

revoke all on function public.list_targeted_practice_tags() from public, anon;
grant execute on function public.list_targeted_practice_tags() to authenticated;

create or replace function public.start_targeted_practice(
  p_level public.jlpt_level,
  p_tag_slug text,
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  tag_id uuid;
  session_id uuid;
  eligible_count integer;
  inserted_count integer;
begin
  if actor_id is null then raise exception 'Sign in before starting practice'; end if;
  if p_request_key is null then raise exception 'A request key is required'; end if;
  if p_level is null or length(trim(coalesce(p_tag_slug, ''))) = 0 then
    raise exception 'Choose a JLPT level and skill';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 15));
  select s.id into session_id from public.practice_sessions s
  where s.user_id = actor_id and s.request_key = p_request_key;
  if found then return session_id; end if;

  select t.id into tag_id from public.tags t
  where t.slug = lower(trim(p_tag_slug)) and t.tag_type = 'skill';
  if not found then raise exception 'That skill is not available for practice'; end if;

  select count(*)::integer into eligible_count
  from public.questions q
  join public.question_tags qt on qt.question_id = q.id and qt.tag_id = tag_id
  where private.is_targeted_practice_question(q.id, p_level);
  if eligible_count < 5 then raise exception 'This skill does not have five reviewed practice questions yet'; end if;

  insert into public.practice_sessions (user_id, level, tag_slug, request_key)
  values (actor_id, p_level, lower(trim(p_tag_slug)), p_request_key)
  returning id into session_id;

  insert into public.practice_session_items (session_id, question_id, position)
  select session_id, selected.question_id, selected.position::smallint
  from (
    select q.id as question_id,
      row_number() over (
        order by
          case when exists (
            select 1
            from public.practice_session_items recent_item
            join public.practice_sessions recent_session on recent_session.id = recent_item.session_id
            where recent_session.user_id = actor_id
              and recent_session.created_at > clock_timestamp() - interval '7 days'
              and recent_item.question_id = q.id
          ) then 1 else 0 end,
          uqs.last_seen_at nulls first,
          random()
      ) as position
    from public.questions q
    join public.question_tags qt on qt.question_id = q.id and qt.tag_id = tag_id
    left join public.user_question_stats uqs on uqs.user_id = actor_id and uqs.question_id = q.id
    where private.is_targeted_practice_question(q.id, p_level)
  ) selected
  order by selected.position
  limit 5;

  get diagnostics inserted_count = row_count;
  if inserted_count <> 5 then raise exception 'Could not prepare the complete practice set'; end if;
  return session_id;
end;
$$;

revoke all on function public.start_targeted_practice(public.jlpt_level, text, uuid) from public, anon;
grant execute on function public.start_targeted_practice(public.jlpt_level, text, uuid) to authenticated;

create or replace function public.get_targeted_practice_session(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id,
      'level', s.level,
      'tag_slug', s.tag_slug,
      'status', s.status,
      'question_count', s.question_count,
      'raw_correct', s.raw_correct,
      'raw_incorrect', s.raw_incorrect,
      'raw_unanswered', s.raw_unanswered,
      'submitted_at', s.submitted_at,
      'created_at', s.created_at
    ),
    'questions', coalesce(jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'position', psi.position,
      'item_type_code', q.item_type_code,
      'prompt', q.prompt,
      'options', q.options,
      'selected_option_id', psi.selected_option_id
    ) order by psi.position), '[]'::jsonb)
  )
  from public.practice_sessions s
  join public.practice_session_items psi on psi.session_id = s.id
  join public.questions q on q.id = psi.question_id
  where s.id = p_session_id and s.user_id = (select auth.uid())
  group by s.id, s.level, s.tag_slug, s.status, s.question_count,
    s.raw_correct, s.raw_incorrect, s.raw_unanswered, s.submitted_at, s.created_at;
$$;

revoke all on function public.get_targeted_practice_session(uuid) from public, anon;
grant execute on function public.get_targeted_practice_session(uuid) to authenticated;

create or replace function public.save_targeted_practice_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_option_id text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved_time timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sign in before saving a practice answer'; end if;
  perform 1 from public.practice_sessions s
  where s.id = p_session_id and s.user_id = actor_id and s.status = 'in_progress'
  for update;
  if not found then raise exception 'This practice session is not active'; end if;
  if p_selected_option_id is not null and not exists (
    select 1
    from public.practice_session_items psi
    join public.questions q on q.id = psi.question_id
    cross join lateral jsonb_array_elements(q.options) opt
    where psi.session_id = p_session_id
      and psi.question_id = p_question_id
      and opt.value ->> 'id' = p_selected_option_id
  ) then raise exception 'Choose an available answer option'; end if;

  update public.practice_session_items
  set selected_option_id = p_selected_option_id,
      saved_at = saved_time
  where session_id = p_session_id and question_id = p_question_id;
  if not found then raise exception 'Question is not part of this practice session'; end if;
  return saved_time;
end;
$$;

revoke all on function public.save_targeted_practice_answer(uuid, uuid, text) from public, anon;
grant execute on function public.save_targeted_practice_answer(uuid, uuid, text) to authenticated;

create or replace function public.submit_targeted_practice(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  session_row public.practice_sessions%rowtype;
  total_count integer;
  correct_count integer;
  incorrect_count integer;
  unanswered_count integer;
  submitted_time timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sign in before submitting practice'; end if;
  select s.* into session_row from public.practice_sessions s
  where s.id = p_session_id and s.user_id = actor_id
  for update;
  if not found then raise exception 'Practice session was not found'; end if;
  if session_row.status = 'submitted' then
    return jsonb_build_object(
      'id', session_row.id, 'status', session_row.status,
      'raw_correct', session_row.raw_correct, 'raw_incorrect', session_row.raw_incorrect,
      'raw_unanswered', session_row.raw_unanswered, 'question_count', session_row.question_count
    );
  end if;

  select count(*)::integer,
    count(*) filter (where psi.selected_option_id is not null and psi.selected_option_id = ak.correct_option_id)::integer,
    count(*) filter (where psi.selected_option_id is not null and psi.selected_option_id <> ak.correct_option_id)::integer,
    count(*) filter (where psi.selected_option_id is null)::integer
  into total_count, correct_count, incorrect_count, unanswered_count
  from public.practice_session_items psi
  join public.questions q on q.id = psi.question_id
  join public.question_answer_keys ak on ak.question_id = q.id
  where psi.session_id = p_session_id;
  if total_count <> session_row.question_count then raise exception 'Practice set data is incomplete'; end if;

  update public.practice_session_items psi
  set graded_correct = psi.selected_option_id is not null and psi.selected_option_id = ak.correct_option_id
  from public.question_answer_keys ak
  where psi.session_id = p_session_id and ak.question_id = psi.question_id;

  update public.practice_sessions
  set status = 'submitted',
      raw_correct = correct_count,
      raw_incorrect = incorrect_count,
      raw_unanswered = unanswered_count,
      submitted_at = submitted_time
  where id = p_session_id;

  insert into public.user_question_stats (user_id, question_id, times_seen, correct_count, last_seen_at)
  select actor_id, psi.question_id, 1,
    case when psi.graded_correct then 1 else 0 end,
    submitted_time
  from public.practice_session_items psi
  where psi.session_id = p_session_id
  on conflict (user_id, question_id) do update
  set times_seen = public.user_question_stats.times_seen + 1,
      correct_count = public.user_question_stats.correct_count + excluded.correct_count,
      last_seen_at = excluded.last_seen_at;

  return jsonb_build_object(
    'id', p_session_id, 'status', 'submitted',
    'raw_correct', correct_count, 'raw_incorrect', incorrect_count,
    'raw_unanswered', unanswered_count, 'question_count', total_count
  );
end;
$$;

revoke all on function public.submit_targeted_practice(uuid) from public, anon;
grant execute on function public.submit_targeted_practice(uuid) to authenticated;

create or replace function public.get_targeted_practice_review(p_session_id uuid)
returns table (
  question_id uuid,
  position smallint,
  item_type_code text,
  prompt jsonb,
  options jsonb,
  selected_option_id text,
  correct_option_id text,
  explanation jsonb,
  distractor_rationales jsonb,
  is_correct boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, psi.position, q.item_type_code, q.prompt, q.options,
    psi.selected_option_id, ak.correct_option_id, ak.explanation,
    ak.distractor_rationales,
    (psi.selected_option_id is not null and psi.selected_option_id = ak.correct_option_id)
  from public.practice_sessions s
  join public.practice_session_items psi on psi.session_id = s.id
  join public.questions q on q.id = psi.question_id
  join public.question_answer_keys ak on ak.question_id = q.id
  where s.id = p_session_id and s.user_id = (select auth.uid()) and s.status = 'submitted'
  order by psi.position;
$$;

revoke all on function public.get_targeted_practice_review(uuid) from public, anon;
grant execute on function public.get_targeted_practice_review(uuid) to authenticated;

create or replace function public.list_my_targeted_practice_sessions()
returns table (
  id uuid,
  level public.jlpt_level,
  tag_slug text,
  status text,
  question_count smallint,
  raw_correct smallint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.level, s.tag_slug, s.status, s.question_count, s.raw_correct, s.created_at
  from public.practice_sessions s
  where s.user_id = (select auth.uid())
  order by s.created_at desc
  limit 20;
$$;

revoke all on function public.list_my_targeted_practice_sessions() from public, anon;
grant execute on function public.list_my_targeted_practice_sessions() to authenticated;

comment on table public.practice_sessions is
  'Learner-owned five-question targeted practice sessions. Answer keys are released only after submission.';

comment on table public.practice_session_items is
  'Question membership and saved choices for private targeted-practice sessions.';

commit;
