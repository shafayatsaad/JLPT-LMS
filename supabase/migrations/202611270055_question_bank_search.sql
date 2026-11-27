begin;

-- Question revisions are edited in place only while they remain drafts. Keep
-- an accurate revision update timestamp so staff can sort that workflow.
alter table public.questions
  add column if not exists updated_at timestamptz;

update public.questions
set updated_at = created_at
where updated_at is null;

alter table public.questions
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function private.touch_question_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists touch_question_updated_at on public.questions;
create trigger touch_question_updated_at
before update on public.questions
for each row execute function private.touch_question_updated_at();

-- Centralized, role-checked search with bounded pagination. The function runs
-- with the caller's privileges, so existing table RLS remains in force.
create or replace function public.search_question_bank(
  p_search text default null,
  p_level text default null,
  p_section text default null,
  p_item_type text default null,
  p_skill text default null,
  p_status text default null,
  p_difficulty smallint default null,
  p_sort text default 'created_desc',
  p_page integer default 1,
  p_page_size integer default 50
)
returns table(items jsonb, total_count bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  search_text text := lower(left(trim(coalesce(p_search, '')), 120));
  skill_text text := lower(left(trim(coalesce(p_skill, '')), 80));
  section_filter text := left(trim(coalesce(p_section, '')), 80);
  type_filter text := left(trim(coalesce(p_item_type, '')), 80);
  level_filter text := upper(left(trim(coalesce(p_level, '')), 2));
  status_filter text := lower(left(trim(coalesce(p_status, '')), 40));
  sort_order text := case when p_sort in ('created_asc', 'created_desc', 'updated_asc', 'updated_desc', 'level_asc', 'status_asc') then p_sort else 'created_desc' end;
  page_number integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
begin
  if actor_id is null or not (select private.has_any_role(array[
    'content_editor'::public.app_role,
    'reviewer'::public.app_role,
    'admin'::public.app_role
  ])) then
    raise exception 'Question bank access is required';
  end if;

  if level_filter <> '' and level_filter not in ('N1', 'N2', 'N3', 'N4', 'N5') then
    raise exception 'Unsupported JLPT level filter';
  end if;
  if status_filter <> '' and status_filter not in ('draft', 'needs_review', 'approved', 'eligible_for_exam', 'rejected', 'retired') then
    raise exception 'Unsupported question status filter';
  end if;
  if p_difficulty is not null and p_difficulty not between 1 and 5 then
    raise exception 'Difficulty must be between 1 and 5';
  end if;

  return query
  with filtered as (
    select
      q.id,
      q.content_key,
      q.revision,
      q.level,
      q.test_section_code,
      q.score_category_code,
      q.item_type_code,
      q.difficulty_estimate,
      q.status,
      q.authored_by,
      q.created_at,
      q.updated_at,
      q.prompt,
      coalesce((
        select array_agg(distinct t.slug order by t.slug)
        from public.question_tags qt
        join public.tags t on t.id = qt.tag_id and t.tag_type = 'skill'
        where qt.question_id = q.id
      ), array[]::text[]) as skill_tags
    from public.questions q
    where (search_text = '' or position(search_text in lower(q.id::text || ' ' || q.content_key::text || ' ' || q.prompt::text)) > 0)
      and (level_filter = '' or q.level::text = level_filter)
      and (section_filter = '' or q.test_section_code = section_filter)
      and (type_filter = '' or q.item_type_code = type_filter)
      and (status_filter = '' or q.status::text = status_filter)
      and (p_difficulty is null or q.difficulty_estimate = p_difficulty)
      and (skill_text = '' or exists (
        select 1
        from public.question_tags skill_link
        join public.tags skill_tag on skill_tag.id = skill_link.tag_id and skill_tag.tag_type = 'skill'
        where skill_link.question_id = q.id and position(skill_text in lower(skill_tag.slug)) > 0
      ))
  ), page_rows as (
    select f.*
    from filtered f
    order by
      case when sort_order = 'level_asc' then f.level::text end asc,
      case when sort_order = 'status_asc' then f.status::text end asc,
      case when sort_order = 'created_asc' then f.created_at end asc,
      case when sort_order = 'created_desc' then f.created_at end desc,
      case when sort_order = 'updated_asc' then f.updated_at end asc,
      case when sort_order = 'updated_desc' then f.updated_at end desc,
      f.id asc
    limit page_size offset ((page_number - 1) * page_size)
  )
  select
    coalesce((select jsonb_agg(to_jsonb(page_rows)) from page_rows), '[]'::jsonb),
    (select count(*) from filtered);
end;
$$;

revoke all on function public.search_question_bank(text, text, text, text, text, text, smallint, text, integer, integer) from public, anon;
grant execute on function public.search_question_bank(text, text, text, text, text, text, smallint, text, integer, integer) to authenticated;

commit;
