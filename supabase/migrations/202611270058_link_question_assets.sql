begin;

create or replace function public.link_existing_question_asset(
  p_question_id uuid,
  p_asset_id uuid,
  p_purpose text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  question_row public.questions%rowtype;
  asset_row public.content_assets%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_purpose not in ('question_audio', 'question_image', 'stimulus_audio', 'stimulus_image') then
    raise exception 'Unsupported question media purpose';
  end if;

  select q.* into question_row from public.questions q where q.id = p_question_id for update;
  if not found or question_row.status <> 'draft'
    or (question_row.authored_by <> actor_id and not (select private.has_role('admin'::public.app_role))) then
    raise exception 'Only the author or an administrator may link media to a draft question';
  end if;

  select ca.* into asset_row from public.content_assets ca where ca.id = p_asset_id for update;
  if not found or asset_row.status not in ('draft', 'approved', 'eligible_for_exam') then
    raise exception 'Only draft or approved media can be linked';
  end if;
  if asset_row.status = 'draft'
    and asset_row.uploaded_by is distinct from actor_id
    and not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Draft media can only be linked by its uploader';
  end if;
  if (p_purpose like '%audio' and split_part(lower(asset_row.media_type), '/', 1) <> 'audio')
    or (p_purpose like '%image' and split_part(lower(asset_row.media_type), '/', 1) <> 'image') then
    raise exception 'The selected file type does not match this question media purpose';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'jlpt-question-assets' and o.name = asset_row.storage_path
  ) then raise exception 'The private media file is missing from storage'; end if;
  if exists (select 1 from public.question_assets qa where qa.question_id = p_question_id and qa.asset_id = p_asset_id and qa.purpose = p_purpose) then
    raise exception 'This file is already linked to that question for this purpose';
  end if;

  insert into public.question_assets (question_id, asset_id, purpose)
  values (p_question_id, p_asset_id, p_purpose);
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'content_asset.linked_to_draft', 'question_asset', p_question_id, null,
    jsonb_build_object('asset_id', p_asset_id, 'purpose', p_purpose, 'question_status', question_row.status, 'asset_status', asset_row.status));
  return true;
end;
$$;

revoke all on function public.link_existing_question_asset(uuid, uuid, text) from public, anon;
grant execute on function public.link_existing_question_asset(uuid, uuid, text) to authenticated;

commit;
