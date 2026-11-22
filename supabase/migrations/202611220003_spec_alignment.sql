-- Completes the versioned content and attempt snapshot model described by the
-- JLPT platform specs. Apply after 202611220001 and 202611220002.
begin;

-- `questions` is the existing immutable revision table. Give its stable
-- content_key an explicit family row instead of duplicating question data in
-- a second revision table.
create table if not exists public.question_families (
  id uuid primary key,
  level public.jlpt_level not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

insert into public.question_families (id, level, created_by)
select distinct on (q.content_key) q.content_key, q.level, q.authored_by
from public.questions q
order by q.content_key, q.revision asc, q.created_at asc
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_content_family_fk'
  ) then
    alter table public.questions
      add constraint questions_content_family_fk
      foreign key (content_key) references public.question_families(id) on delete restrict;
  end if;
end;
$$;

create or replace function private.ensure_question_family()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  family_level public.jlpt_level;
begin
  select f.level into family_level
  from public.question_families f
  where f.id = new.content_key;

  if not found then
    insert into public.question_families (id, level, created_by)
    values (new.content_key, new.level, new.authored_by)
    on conflict (id) do nothing;

    select f.level into family_level
    from public.question_families f
    where f.id = new.content_key;
  end if;

  if family_level is distinct from new.level then
    raise exception 'A question revision must use its family level';
  end if;

  return new;
end;
$$;

revoke all on function private.ensure_question_family() from public, anon, authenticated;
drop trigger if exists ensure_question_family_before_revision on public.questions;
create trigger ensure_question_family_before_revision
  before insert on public.questions
  for each row execute function private.ensure_question_family();

-- A question may reference a shared passage/dialogue. This ordered relation
-- keeps grouped questions together during exam assembly and review.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_id_stimulus_group_key'
  ) then
    alter table public.questions
      add constraint questions_id_stimulus_group_key unique (id, stimulus_group_id);
  end if;
end;
$$;

create table if not exists public.content_group_items (
  passage_group_id uuid not null references public.passage_groups(id) on delete restrict,
  question_id uuid not null,
  position integer not null check (position > 0),
  required_together boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (passage_group_id, question_id),
  unique (passage_group_id, position),
  foreign key (question_id, passage_group_id)
    references public.questions(id, stimulus_group_id) on delete restrict
);

create index if not exists content_group_items_question_idx
  on public.content_group_items (question_id);

alter table public.question_families enable row level security;
alter table public.content_group_items enable row level security;
revoke all on public.question_families from anon, authenticated;
revoke all on public.content_group_items from anon, authenticated;

grant select on public.content_group_items to anon, authenticated;
grant insert, update, delete on public.content_group_items to authenticated;

drop policy if exists "question groups: published or staff read" on public.content_group_items;
create policy "question groups: published or staff read"
  on public.content_group_items for select to anon, authenticated
  using (
    exists (
      select 1
      from public.passage_groups pg
      join public.questions q on q.id = question_id
      where pg.id = passage_group_id
        and pg.status in ('approved', 'eligible_for_exam')
        and q.status in ('approved', 'eligible_for_exam')
    )
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "question groups: editors manage drafts" on public.content_group_items;
create policy "question groups: editors manage drafts"
  on public.content_group_items for all to authenticated
  using (
    exists (
      select 1 from public.passage_groups pg
      join public.questions q on q.id = question_id
      where pg.id = passage_group_id
        and pg.status = 'draft'
        and q.status = 'draft'
        and pg.authored_by = (select auth.uid())
        and q.authored_by = (select auth.uid())
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    exists (
      select 1 from public.passage_groups pg
      join public.questions q on q.id = question_id
      where pg.id = passage_group_id
        and pg.status = 'draft'
        and q.status = 'draft'
        and pg.authored_by = (select auth.uid())
        and q.authored_by = (select auth.uid())
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

-- Store section duration on the blueprint and a self-contained form snapshot
-- on each attempt so later content edits cannot change historical attempts.
alter table public.blueprint_slots
  add column if not exists section_duration_seconds integer not null default 0
  check (section_duration_seconds >= 0);

alter table public.attempt_sections
  add column if not exists duration_seconds integer not null default 0
  check (duration_seconds >= 0);

alter table public.exam_attempts
  add column if not exists form_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists snapshot_created_at timestamptz;

alter table public.exam_results
  add column if not exists grading_version text not null default 'raw-v1',
  add column if not exists graded_at timestamptz;

alter table public.question_answer_keys
  add column if not exists distractor_rationales jsonb not null default '{}'::jsonb;

alter table public.attempt_answers
  add column if not exists exam_form_item_id uuid;

update public.attempt_answers aa
set exam_form_item_id = fi.id
from public.exam_attempts a, public.exam_form_items fi
where a.id = aa.attempt_id
  and fi.exam_form_id = a.exam_form_id
  and fi.question_id = aa.question_id
  and aa.exam_form_item_id is null;

do $$
begin
  if exists (select 1 from public.attempt_answers where exam_form_item_id is null) then
    raise exception 'Cannot map every saved answer to a frozen exam form item; resolve unmatched attempt answers before applying this migration';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attempt_answers'::regclass
      and conname = 'attempt_answers_form_item_fk'
  ) then
    alter table public.attempt_answers
      add constraint attempt_answers_form_item_fk
      foreign key (exam_form_item_id) references public.exam_form_items(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attempt_answers'::regclass
      and conname = 'attempt_answers_attempt_form_item_unique'
  ) then
    alter table public.attempt_answers
      add constraint attempt_answers_attempt_form_item_unique
      unique (attempt_id, exam_form_item_id);
  end if;
end;
$$;

alter table public.attempt_answers
  alter column exam_form_item_id set not null;

create or replace function private.validate_attempt_answer_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_form_id uuid;
  item_form_id uuid;
  item_question_id uuid;
begin
  select a.exam_form_id into attempt_form_id
  from public.exam_attempts a
  where a.id = new.attempt_id;

  select fi.exam_form_id, fi.question_id
    into item_form_id, item_question_id
  from public.exam_form_items fi
  where fi.id = new.exam_form_item_id;

  if attempt_form_id is null
    or item_form_id is distinct from attempt_form_id
    or item_question_id is distinct from new.question_id
  then
    raise exception 'Answer must reference the matching item from its attempt form';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_attempt_answer_item() from public, anon, authenticated;
drop trigger if exists validate_attempt_answer_form_item on public.attempt_answers;
create trigger validate_attempt_answer_form_item
  before insert or update of attempt_id, question_id, exam_form_item_id
  on public.attempt_answers
  for each row execute function private.validate_attempt_answer_item();

create or replace function private.snapshot_published_form_for_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  form_row public.exam_forms%rowtype;
  item_count integer;
begin
  select f.* into form_row
  from public.exam_forms f
  where f.id = new.exam_form_id;

  if not found or form_row.status <> 'published' or not form_row.is_frozen then
    raise exception 'Only published, frozen exam forms can be attempted';
  end if;

  select count(*) into item_count
  from public.exam_form_items fi
  join public.questions q on q.id = fi.question_id
  where fi.exam_form_id = form_row.id
    and q.status in ('approved', 'eligible_for_exam');

  if item_count = 0 or item_count <> (
    select count(*) from public.exam_form_items fi where fi.exam_form_id = form_row.id
  ) then
    raise exception 'A published form must contain only reviewed questions';
  end if;

  new.form_snapshot := jsonb_build_object(
    'form_id', form_row.id,
    'form_code', form_row.form_code,
    'version', form_row.version,
    'level', form_row.level,
    'manifest', form_row.manifest,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'form_item_id', fi.id,
          'question_id', q.id,
          'question_family_id', q.content_key,
          'question_revision', q.revision,
          'position', fi.position,
          'group_position', fi.group_position,
          'section_code', q.test_section_code,
          'score_category_code', q.score_category_code,
          'item_type_code', q.item_type_code,
          'prompt', q.prompt,
          'options', q.options,
          'stimulus', pg.content
        ) order by fi.position
      )
      from public.exam_form_items fi
      join public.questions q on q.id = fi.question_id
      left join public.passage_groups pg on pg.id = q.stimulus_group_id
      where fi.exam_form_id = form_row.id
    ), '[]'::jsonb)
  );
  new.snapshot_created_at := now();

  return new;
end;
$$;

revoke all on function private.snapshot_published_form_for_attempt() from public, anon, authenticated;
drop trigger if exists snapshot_published_form_before_attempt on public.exam_attempts;
create trigger snapshot_published_form_before_attempt
  before insert on public.exam_attempts
  for each row execute function private.snapshot_published_form_for_attempt();

create index if not exists exam_attempts_status_deadline_idx
  on public.exam_attempts (status, deadline_at);
create index if not exists attempt_answers_item_idx
  on public.attempt_answers (exam_form_item_id);

commit;
