begin;

create index if not exists exam_attempts_completed_level_idx
  on public.exam_attempts (level, submitted_at desc)
  where status in ('submitted', 'expired') and submitted_at is not null;

create or replace function public.get_student_leaderboard(
  p_level public.jlpt_level,
  p_period text default 'all_time',
  p_limit integer default 10
)
returns table (
  rank bigint,
  learner_alias text,
  level public.jlpt_level,
  raw_correct integer,
  total_questions integer,
  score_percent numeric,
  submitted_at timestamptz,
  is_current_user boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  period_start timestamptz;
  result_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  if actor_id is null then raise exception 'Sign in to view the leaderboard'; end if;
  if p_level is null then raise exception 'Choose a JLPT level'; end if;
  if p_period not in ('all_time', '7d', '30d') then raise exception 'Unsupported leaderboard period'; end if;

  period_start := case p_period
    when '7d' then now() - interval '7 days'
    when '30d' then now() - interval '30 days'
    else null
  end;

  return query
  with scored_attempts as (
    select
      a.user_id,
      a.id as attempt_id,
      a.level,
      r.raw_correct,
      (r.raw_correct + r.raw_incorrect + r.raw_unanswered)::integer as total_questions,
      round(
        (r.raw_correct::numeric / nullif(r.raw_correct + r.raw_incorrect + r.raw_unanswered, 0)) * 100,
        1
      ) as score_percent,
      a.submitted_at,
      row_number() over (
        partition by a.user_id
        order by
          r.raw_correct::numeric / nullif(r.raw_correct + r.raw_incorrect + r.raw_unanswered, 0) desc,
          r.raw_correct desc,
          a.submitted_at asc,
          a.id asc
      ) as personal_result_order
    from public.exam_attempts a
    join public.exam_results r on r.attempt_id = a.id
    join public.exam_forms f on f.id = a.exam_form_id
    where a.level = p_level
      and a.status in ('submitted', 'expired')
      and a.submitted_at is not null
      and r.raw_correct + r.raw_incorrect + r.raw_unanswered > 0
      and f.status = 'published'
      and f.is_frozen
      and (period_start is null or a.submitted_at >= period_start)
  ), best_result_per_student as (
    select scored_attempts.*
    from scored_attempts
    where personal_result_order = 1
  ), ranked_students as (
    select
      row_number() over (
        order by best_result_per_student.score_percent desc,
          best_result_per_student.raw_correct desc,
          best_result_per_student.submitted_at asc,
          best_result_per_student.user_id asc
      ) as student_rank,
      best_result_per_student.*
    from best_result_per_student
  )
  select
    ranked.student_rank,
    'Learner ' || upper(substr(pg_catalog.md5(ranked.user_id::text), 1, 6)),
    ranked.level,
    ranked.raw_correct,
    ranked.total_questions,
    ranked.score_percent,
    ranked.submitted_at,
    ranked.user_id = actor_id
  from ranked_students ranked
  where ranked.student_rank <= result_limit or ranked.user_id = actor_id
  order by ranked.student_rank;
end;
$$;

revoke all on function public.get_student_leaderboard(public.jlpt_level, text, integer) from public, anon;
grant execute on function public.get_student_leaderboard(public.jlpt_level, text, integer) to authenticated;

comment on function public.get_student_leaderboard(public.jlpt_level, text, integer) is
  'Ranks one best completed, frozen published-form result per learner and JLPT level. Returns pseudonyms and score totals only; never returns profile, email, phone, or attempt identifiers.';

commit;
