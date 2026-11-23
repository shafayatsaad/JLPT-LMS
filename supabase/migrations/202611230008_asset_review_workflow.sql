-- Private question media registration and separate reviewer approval.
-- Apply after migrations 001 through 007.

begin;

alter table public.content_assets
  add column if not exists uploaded_by uuid references auth.users(id);

create table if not exists public.content_asset_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.content_assets(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved', 'rejected', 'needs_changes')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists content_asset_reviews_asset_idx
  on public.content_asset_reviews (asset_id, created_at desc);

alter table public.content_asset_reviews enable row level security;
revoke all on public.content_asset_reviews from anon, authenticated;
grant select on public.content_asset_reviews to authenticated;
create policy "asset reviews: reviewers read"
  on public.content_asset_reviews for select to authenticated
  using ((select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role])));

-- Question files become immutable once submitted for review, approved or attached
-- to a historical attempt. Staff can replace/delete only their own draft files.
drop policy if exists "JLPT editors upload private question assets" on storage.objects;
create policy "JLPT editors upload to own private workspace"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'jlpt-question-assets'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "JLPT editors update private question assets" on storage.objects;
create policy "JLPT editors update own draft question assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'jlpt-question-assets'
    and exists (
      select 1 from public.content_assets ca
      where ca.storage_path = name
        and ca.status = 'draft'
        and (ca.uploaded_by = (select auth.uid()) or (select private.has_role('admin'::public.app_role)))
    )
  )
  with check (
    bucket_id = 'jlpt-question-assets'
    and exists (
      select 1 from public.content_assets ca
      where ca.storage_path = name
        and ca.status = 'draft'
        and (ca.uploaded_by = (select auth.uid()) or (select private.has_role('admin'::public.app_role)))
    )
  );

drop policy if exists "JLPT editors delete private question assets" on storage.objects;
create policy "JLPT editors delete own draft question assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'jlpt-question-assets'
    and (
      exists (
        select 1 from public.content_assets ca
        where ca.storage_path = name
          and ca.status = 'draft'
          and (ca.uploaded_by = (select auth.uid()) or (select private.has_role('admin'::public.app_role)))
      )
      or (
        not exists (select 1 from public.content_assets ca where ca.storage_path = name)
        and split_part(name, '/', 1) = (select auth.uid())::text
        and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
      )
    )
  );

create or replace function public.register_question_asset(
  p_question_id uuid,
  p_storage_path text,
  p_media_type text,
  p_purpose text,
  p_duration_seconds numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  question_row public.questions%rowtype;
  asset_id uuid;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  select q.* into question_row
  from public.questions q
  where q.id = p_question_id and q.authored_by = actor_id
  for update;
  if not found or question_row.status <> 'draft' then raise exception 'Assets can only be attached to your own draft question'; end if;
  if length(trim(coalesce(p_storage_path, ''))) = 0 or length(p_storage_path) > 1024 then
    raise exception 'A valid uploaded storage path is required';
  end if;
  if split_part(p_storage_path, '/', 1) <> actor_id::text then
    raise exception 'Question media must be uploaded under your own private workspace';
  end if;
  if p_media_type not in ('audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Unsupported question media type';
  end if;
  if length(trim(coalesce(p_purpose, ''))) = 0 or length(p_purpose) > 80 then
    raise exception 'Asset purpose is required';
  end if;
  if p_duration_seconds is not null and (p_duration_seconds <= 0 or p_duration_seconds > 7200) then
    raise exception 'Audio duration is outside the supported range';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'jlpt-question-assets' and o.name = p_storage_path
  ) then raise exception 'Upload the file to the private question-assets bucket first'; end if;

  insert into public.content_assets (storage_path, media_type, duration_seconds, status, uploaded_by)
  values (p_storage_path, p_media_type, p_duration_seconds, 'draft', actor_id)
  returning id into asset_id;

  insert into public.question_assets (question_id, asset_id, purpose)
  values (p_question_id, asset_id, trim(p_purpose));

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (
    actor_id, 'question_asset.registered', 'content_asset', asset_id,
    jsonb_build_object('question_id', p_question_id, 'media_type', p_media_type, 'status', 'draft')
  );
  return asset_id;
end;
$$;

revoke all on function public.register_question_asset(uuid, text, text, text, numeric) from public, anon;
grant execute on function public.register_question_asset(uuid, text, text, text, numeric) to authenticated;

create or replace function public.submit_content_asset_for_review(p_asset_id uuid)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  asset_row public.content_assets%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  select ca.* into asset_row
  from public.content_assets ca
  where ca.id = p_asset_id and ca.uploaded_by = actor_id
  for update;
  if not found or asset_row.status <> 'draft' then raise exception 'Only your own draft asset can be submitted'; end if;
  if not exists (select 1 from public.question_assets qa where qa.asset_id = p_asset_id) then
    raise exception 'Attach the asset to a question before review';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'jlpt-question-assets' and o.name = asset_row.storage_path
  ) then raise exception 'The private asset file is missing from storage'; end if;

  update public.content_assets set status = 'needs_review' where id = p_asset_id;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (
    actor_id, 'content_asset.submitted_for_review', 'content_asset', p_asset_id,
    jsonb_build_object('status', asset_row.status), jsonb_build_object('status', 'needs_review')
  );
  return 'needs_review'::public.content_status;
end;
$$;

revoke all on function public.submit_content_asset_for_review(uuid) from public, anon;
grant execute on function public.submit_content_asset_for_review(uuid) to authenticated;

create or replace function public.review_content_asset(
  p_asset_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.content_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  asset_row public.content_assets%rowtype;
  next_status public.content_status;
begin
  if actor_id is null or not (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content reviewer role required';
  end if;
  if p_decision not in ('approved', 'rejected', 'needs_changes') then raise exception 'Unsupported asset review decision'; end if;
  if length(coalesce(p_notes, '')) > 2000 then raise exception 'Review notes are limited to 2000 characters'; end if;

  select ca.* into asset_row
  from public.content_assets ca
  where ca.id = p_asset_id
  for update;
  if not found or asset_row.status <> 'needs_review' then raise exception 'Asset is not awaiting review'; end if;
  if asset_row.uploaded_by = actor_id then raise exception 'Authors cannot review their own assets'; end if;
  if p_decision = 'approved' and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'jlpt-question-assets' and o.name = asset_row.storage_path
  ) then raise exception 'The private asset file is missing from storage'; end if;

  next_status := case p_decision
    when 'approved' then 'approved'::public.content_status
    when 'rejected' then 'rejected'::public.content_status
    else 'draft'::public.content_status
  end;

  insert into public.content_asset_reviews (asset_id, reviewer_id, decision, notes)
  values (p_asset_id, actor_id, p_decision, nullif(trim(p_notes), ''));

  update public.content_assets
  set status = next_status,
      approved_by = case when next_status = 'approved' then actor_id else null end,
      approved_at = case when next_status = 'approved' then clock_timestamp() else null end
  where id = p_asset_id;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (
    actor_id, 'content_asset.review.' || p_decision, 'content_asset', p_asset_id,
    jsonb_build_object('status', asset_row.status), jsonb_build_object('status', next_status, 'notes', nullif(trim(p_notes), ''))
  );
  return next_status;
end;
$$;

revoke all on function public.review_content_asset(uuid, text, text) from public, anon;
grant execute on function public.review_content_asset(uuid, text, text) to authenticated;

create or replace function public.get_content_asset_review_queue()
returns table (
  id uuid,
  storage_path text,
  media_type text,
  status public.content_status,
  duration_seconds numeric,
  uploaded_by uuid,
  created_at timestamptz,
  question_id uuid,
  purpose text,
  question_prompt jsonb
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
  select ca.id, ca.storage_path, ca.media_type, ca.status, ca.duration_seconds,
    ca.uploaded_by, ca.created_at, qa.question_id, qa.purpose, q.prompt
  from public.content_assets ca
  join public.question_assets qa on qa.asset_id = ca.id
  join public.questions q on q.id = qa.question_id
  where ca.status = 'needs_review'
  order by ca.created_at asc
  limit 100;
end;
$$;

revoke all on function public.get_content_asset_review_queue() from public, anon;
grant execute on function public.get_content_asset_review_queue() to authenticated;

commit;
