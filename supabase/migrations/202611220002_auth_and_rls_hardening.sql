-- Supabase Auth profile provisioning, explicit API grants, and role-scoped RLS.
-- Apply after 202611220001_initial_platform.sql.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
  );
$$;

create or replace function private.has_any_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any(required_roles)
  );
$$;

revoke all on function private.has_role(public.app_role) from public, anon;
revoke all on function private.has_any_role(public.app_role[]) from public, anon;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.has_any_role(public.app_role[]) to anon, authenticated;

create or replace function private.provision_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_level public.jlpt_level;
begin
  requested_level := case upper(coalesce(new.raw_user_meta_data ->> 'target_level', ''))
    when 'N1' then 'N1'::public.jlpt_level
    when 'N2' then 'N2'::public.jlpt_level
    when 'N3' then 'N3'::public.jlpt_level
    when 'N4' then 'N4'::public.jlpt_level
    when 'N5' then 'N5'::public.jlpt_level
    else null
  end;

  insert into public.profiles (user_id, display_name, target_level, explanation_language)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    requested_level,
    'en'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke all on function private.provision_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_provision on auth.users;
create trigger on_auth_user_created_provision
  after insert on auth.users
  for each row execute function private.provision_auth_user();

-- Keep accounts created before this migration usable as students.
insert into public.profiles (user_id, display_name, explanation_language)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
  'en'
from auth.users u
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'student'::public.app_role
from auth.users u
on conflict (user_id, role) do nothing;

-- API privileges are explicit. In particular, no browser role receives access to answer keys.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.tags, public.passage_groups, public.questions,
  public.question_tags, public.exam_blueprints, public.blueprint_slots,
  public.exam_forms, public.exam_form_items, public.plans
to anon;

grant select on public.profiles, public.user_roles, public.tags, public.passage_groups,
  public.questions, public.question_tags, public.content_assets, public.question_assets,
  public.question_reviews, public.exam_blueprints, public.blueprint_slots, public.exam_forms,
  public.exam_form_items, public.exam_attempts, public.attempt_sections, public.attempt_answers,
  public.exam_results, public.user_question_stats, public.plans, public.payment_submissions,
  public.user_entitlements, public.payment_audit_events, public.admin_audit_events
to authenticated;

grant insert on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, target_level, explanation_language, updated_at)
  on public.profiles to authenticated;
grant insert, update, delete on public.tags, public.passage_groups, public.questions,
  public.question_tags, public.content_assets, public.question_assets,
  public.question_answer_keys, public.exam_blueprints, public.blueprint_slots,
  public.exam_forms, public.exam_form_items
to authenticated;
grant update (status) on public.questions, public.passage_groups, public.content_assets,
  public.exam_blueprints to authenticated;

-- Profiles and roles.
create policy "profiles: staff read"
  on public.profiles for select to authenticated
  using ((select private.has_any_role(array['admin'::public.app_role, 'content_editor'::public.app_role, 'reviewer'::public.app_role, 'payment_reviewer'::public.app_role])));

create policy "user roles: read own or staff"
  on public.user_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_role('admin'::public.app_role))
  );

-- Public question content contains prompts and choices only. Answer keys remain ungranted.
create policy "tags: read"
  on public.tags for select to anon, authenticated using (true);
create policy "tags: manage by editors"
  on public.tags for all to authenticated
  using ((select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])))
  with check ((select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])));

create policy "passages: published or editorial read"
  on public.passage_groups for select to anon, authenticated
  using (
    status in ('approved', 'eligible_for_exam')
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
create policy "passages: editor create draft"
  on public.passage_groups for insert to authenticated
  with check (
    authored_by = (select auth.uid())
    and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "passages: editor update draft"
  on public.passage_groups for update to authenticated
  using (
    authored_by = (select auth.uid())
    and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    authored_by = (select auth.uid())
    and status in ('draft', 'needs_review')
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "passages: delete own drafts"
  on public.passage_groups for delete to authenticated
  using (
    authored_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

create policy "questions: published or editorial read"
  on public.questions for select to anon, authenticated
  using (
    status in ('approved', 'eligible_for_exam')
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
create policy "questions: editor create draft"
  on public.questions for insert to authenticated
  with check (
    authored_by = (select auth.uid())
    and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "questions: editor update draft"
  on public.questions for update to authenticated
  using (
    authored_by = (select auth.uid())
    and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    authored_by = (select auth.uid())
    and status in ('draft', 'needs_review')
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "questions: delete own drafts"
  on public.questions for delete to authenticated
  using (
    authored_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

create policy "question tags: published or editorial read"
  on public.question_tags for select to anon, authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.status in ('approved', 'eligible_for_exam')
    )
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
create policy "question tags: editor manage"
  on public.question_tags for all to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.authored_by = (select auth.uid())
        and q.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.authored_by = (select auth.uid())
        and q.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

-- Draft answer keys are writable only by content staff; no anon/authenticated SELECT grant exists.
create policy "answer keys: editor manage drafts"
  on public.question_answer_keys for all to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.authored_by = (select auth.uid())
        and q.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.authored_by = (select auth.uid())
        and q.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

create policy "assets: staff read"
  on public.content_assets for select to authenticated
  using ((select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role])));
create policy "assets: editor create draft"
  on public.content_assets for insert to authenticated
  with check (
    status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "assets: editor update draft"
  on public.content_assets for update to authenticated
  using (
    status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    status in ('draft', 'needs_review')
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "question assets: staff read"
  on public.question_assets for select to authenticated
  using ((select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role])));
create policy "question assets: editor manage"
  on public.question_assets for all to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.authored_by = (select auth.uid())
        and q.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    exists (
      select 1 from public.questions q
      where q.id = question_id and q.authored_by = (select auth.uid())
        and q.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

create policy "question reviews: reviewers read"
  on public.question_reviews for select to authenticated
  using ((select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role])));
-- Published blueprint and exam-form fields are read-only to learners.
create policy "blueprints: published or staff read"
  on public.exam_blueprints for select to anon, authenticated
  using (
    status in ('approved', 'eligible_for_exam')
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
create policy "blueprints: editor manage drafts"
  on public.exam_blueprints for all to authenticated
  using (
    created_by = (select auth.uid()) and status = 'draft'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    created_by = (select auth.uid()) and status in ('draft', 'needs_review')
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "blueprint slots: published or staff read"
  on public.blueprint_slots for select to anon, authenticated
  using (
    exists (
      select 1 from public.exam_blueprints b
      where b.id = blueprint_id and b.status in ('approved', 'eligible_for_exam')
    )
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
create policy "blueprint slots: editor manage drafts"
  on public.blueprint_slots for all to authenticated
  using (
    exists (
      select 1 from public.exam_blueprints b
      where b.id = blueprint_id and b.created_by = (select auth.uid())
        and b.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    exists (
      select 1 from public.exam_blueprints b
      where b.id = blueprint_id and b.created_by = (select auth.uid())
        and b.status = 'draft'
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

create policy "forms: published or staff read"
  on public.exam_forms for select to anon, authenticated
  using (
    status = 'published'
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
create policy "forms: editors manage unfrozen drafts"
  on public.exam_forms for all to authenticated
  using (
    created_by = (select auth.uid()) and status = 'draft' and not is_frozen
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    created_by = (select auth.uid()) and status = 'draft' and not is_frozen
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
create policy "form items: published or staff read"
  on public.exam_form_items for select to anon, authenticated
  using (
    exists (select 1 from public.exam_forms f where f.id = exam_form_id and f.status = 'published')
    or (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
create policy "form items: editors manage unfrozen drafts"
  on public.exam_form_items for all to authenticated
  using (
    exists (
      select 1 from public.exam_forms f
      where f.id = exam_form_id and f.created_by = (select auth.uid())
        and f.status = 'draft' and not f.is_frozen
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    exists (
      select 1 from public.exam_forms f
      where f.id = exam_form_id and f.created_by = (select auth.uid())
        and f.status = 'draft' and not f.is_frozen
    )
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

-- Learners can see their own history. Answers become readable only after an attempt closes.
create policy "attempt sections: read own"
  on public.attempt_sections for select to authenticated
  using (
    exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()))
  );
create policy "attempt answers: read own after close"
  on public.attempt_answers for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = attempt_id and a.user_id = (select auth.uid())
        and a.status in ('submitted', 'expired')
    )
  );

create policy "payments: reviewers read queue"
  on public.payment_submissions for select to authenticated
  using ((select private.has_any_role(array['payment_reviewer'::public.app_role, 'admin'::public.app_role])));
create policy "payment audit: reviewers read"
  on public.payment_audit_events for select to authenticated
  using ((select private.has_any_role(array['payment_reviewer'::public.app_role, 'admin'::public.app_role])));
create policy "admin audit: admins read"
  on public.admin_audit_events for select to authenticated
  using ((select private.has_role('admin'::public.app_role)));

-- Protect approved blueprint revisions and their slots from later edits.
create or replace function private.prevent_approved_blueprint_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_blueprint_id uuid;
  current_status public.content_status;
begin
  if tg_table_name = 'exam_blueprints' then
    target_blueprint_id := coalesce(new.id, old.id);
  else
    target_blueprint_id := coalesce(new.blueprint_id, old.blueprint_id);
  end if;

  select b.status into current_status
  from public.exam_blueprints b
  where b.id = target_blueprint_id;

  if current_status in ('approved', 'eligible_for_exam', 'retired') then
    raise exception 'Approved blueprint revisions are immutable';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.prevent_approved_blueprint_mutation() from public, anon, authenticated;

drop trigger if exists approved_blueprint_immutable on public.exam_blueprints;
create trigger approved_blueprint_immutable
  before update or delete on public.exam_blueprints
  for each row when (old.status in ('approved', 'eligible_for_exam', 'retired'))
  execute function private.prevent_approved_blueprint_mutation();

drop trigger if exists approved_blueprint_slot_immutable on public.blueprint_slots;
create trigger approved_blueprint_slot_immutable
  before insert or update or delete on public.blueprint_slots
  for each row execute function private.prevent_approved_blueprint_mutation();

-- Guard status transitions made by the transactional review function.
create or replace function private.protect_review_decisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status::text is distinct from new.status::text
    and old.status::text in ('needs_review', 'draft')
    and new.status::text in ('approved', 'eligible_for_exam', 'rejected', 'validated', 'draft')
    and (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role]))
  then
    if tg_table_name = 'questions'
      and row(new.content_key, new.revision, new.level, new.test_section_code, new.score_category_code,
        new.item_type_code, new.difficulty_estimate, new.stimulus_group_id, new.prompt, new.options, new.authored_by)
        is distinct from
        row(old.content_key, old.revision, old.level, old.test_section_code, old.score_category_code,
        old.item_type_code, old.difficulty_estimate, old.stimulus_group_id, old.prompt, old.options, old.authored_by)
    then
      raise exception 'Review decisions cannot edit authored question fields';
    elsif tg_table_name = 'passage_groups'
      and row(new.content_key, new.revision, new.level, new.group_type, new.content, new.authored_by)
        is distinct from row(old.content_key, old.revision, old.level, old.group_type, old.content, old.authored_by)
    then
      raise exception 'Review decisions cannot edit authored passage fields';
    elsif tg_table_name = 'exam_blueprints'
      and row(new.level, new.version, new.created_by)
        is distinct from row(old.level, old.version, old.created_by)
    then
      raise exception 'Review decisions cannot edit blueprint fields';
    elsif tg_table_name = 'content_assets'
      and row(new.storage_path, new.media_type, new.checksum_sha256, new.duration_seconds, new.created_at)
        is distinct from row(old.storage_path, old.media_type, old.checksum_sha256, old.duration_seconds, old.created_at)
    then
      raise exception 'Asset review decisions cannot edit asset metadata';
    elsif tg_table_name = 'exam_forms'
      and row(new.blueprint_id, new.level, new.form_code, new.version, new.assembly_seed, new.manifest, new.is_frozen, new.created_by)
        is distinct from row(old.blueprint_id, old.level, old.form_code, old.version, old.assembly_seed, old.manifest, old.is_frozen, old.created_by)
    then
      raise exception 'Validation decisions cannot edit exam form fields';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_review_decisions() from public, anon, authenticated;

drop trigger if exists protect_question_review_decision on public.questions;
create trigger protect_question_review_decision
  before update on public.questions
  for each row execute function private.protect_review_decisions();
drop trigger if exists protect_passage_review_decision on public.passage_groups;
create trigger protect_passage_review_decision
  before update on public.passage_groups
  for each row execute function private.protect_review_decisions();
drop trigger if exists protect_blueprint_review_decision on public.exam_blueprints;
create trigger protect_blueprint_review_decision
  before update on public.exam_blueprints
  for each row execute function private.protect_review_decisions();
drop trigger if exists protect_asset_review_decision on public.content_assets;
create trigger protect_asset_review_decision
  before update on public.content_assets
  for each row execute function private.protect_review_decisions();
drop trigger if exists protect_form_validation_decision on public.exam_forms;
create trigger protect_form_validation_decision
  before update on public.exam_forms
  for each row execute function private.protect_review_decisions();

-- A question review decision, state transition, and audit entry commit together.
create or replace function public.review_question(
  p_question_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  question_row public.questions%rowtype;
  next_status public.content_status;
begin
  if (select auth.uid()) is null
    or not (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role]))
  then
    raise exception 'Reviewer role required';
  end if;

  if p_decision not in ('approved', 'rejected', 'needs_changes') then
    raise exception 'Unsupported question review decision';
  end if;

  select q.* into question_row
  from public.questions q
  where q.id = p_question_id
  for update;

  if not found or question_row.status <> 'needs_review'::public.content_status then
    raise exception 'Question is not awaiting review';
  end if;

  if question_row.authored_by = (select auth.uid()) then
    raise exception 'Authors cannot review their own questions';
  end if;
  if length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Review notes are limited to 2000 characters';
  end if;
  if p_decision = 'approved' and not exists (
    select 1
    from public.question_answer_keys ak
    where ak.question_id = p_question_id
      and exists (
        select 1
        from jsonb_array_elements(question_row.options) as option_rows(option_json)
        where option_json ->> 'id' = ak.correct_option_id
      )
  ) then
    raise exception 'A valid answer key is required before approval';
  end if;

  next_status := case p_decision
    when 'approved' then 'approved'::public.content_status
    when 'rejected' then 'rejected'::public.content_status
    else 'draft'::public.content_status
  end;

  insert into public.question_reviews (question_id, reviewer_id, decision, notes)
  values (p_question_id, (select auth.uid()), p_decision, nullif(trim(p_notes), ''));

  update public.questions
  set status = next_status
  where id = p_question_id;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (
    (select auth.uid()),
    'question_review.' || p_decision,
    'question',
    p_question_id,
    jsonb_build_object('status', question_row.status),
    jsonb_build_object('status', next_status)
  );

  return next_status;
end;
$$;

revoke all on function public.review_question(uuid, text, text) from public, anon;
grant execute on function public.review_question(uuid, text, text) to authenticated;

-- Return answer keys only when the authenticated attempt owner has submitted or expired.
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid,
  level public.jlpt_level,
  prompt jsonb,
  options jsonb,
  selected_option_id text,
  correct_option_id text,
  explanation jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.id,
    q.level,
    q.prompt,
    q.options,
    aa.selected_option_id,
    ak.correct_option_id,
    ak.explanation
  from public.exam_attempts a
  join public.exam_form_items fi on fi.exam_form_id = a.exam_form_id
  join public.questions q on q.id = fi.question_id
  join public.question_answer_keys ak on ak.question_id = q.id
  left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id
  where a.id = p_attempt_id
    and a.user_id = (select auth.uid())
    and a.status in ('submitted'::public.attempt_status, 'expired'::public.attempt_status)
  order by fi.position;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;

-- Listening and question media stay private. Signed URLs are issued by server operations only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jlpt-question-assets',
  'jlpt-question-assets',
  false,
  26214400,
  array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "JLPT staff read private question assets" on storage.objects;
create policy "JLPT staff read private question assets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'jlpt-question-assets'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );
drop policy if exists "JLPT editors upload private question assets" on storage.objects;
create policy "JLPT editors upload private question assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'jlpt-question-assets'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
drop policy if exists "JLPT editors update private question assets" on storage.objects;
create policy "JLPT editors update private question assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'jlpt-question-assets'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    bucket_id = 'jlpt-question-assets'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
drop policy if exists "JLPT editors delete private question assets" on storage.objects;
create policy "JLPT editors delete private question assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'jlpt-question-assets'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );
