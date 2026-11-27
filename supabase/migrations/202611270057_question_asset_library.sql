begin;

alter table public.content_assets
  add column if not exists file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists processing_status text not null default 'stored';

alter table public.content_assets
  drop constraint if exists content_assets_file_size_bytes_check,
  add constraint content_assets_file_size_bytes_check
    check (file_size_bytes is null or file_size_bytes between 1 and 52428800),
  drop constraint if exists content_assets_processing_status_check,
  add constraint content_assets_processing_status_check
    check (processing_status in ('stored', 'missing'));

update public.content_assets
set file_name = split_part(storage_path, '/', array_length(string_to_array(storage_path, '/'), 1))
where file_name is null;

create or replace function public.update_question_asset_file_details(
  p_asset_id uuid,
  p_file_name text,
  p_file_size_bytes bigint
)
returns boolean
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
  if length(trim(coalesce(p_file_name, ''))) not between 1 and 240 then
    raise exception 'File name must be between 1 and 240 characters';
  end if;
  if p_file_size_bytes is not null and p_file_size_bytes not between 1 and 52428800 then
    raise exception 'File size must be between 1 byte and 50 MB';
  end if;

  select ca.* into asset_row
  from public.content_assets ca
  where ca.id = p_asset_id
  for update;
  if not found or asset_row.status <> 'draft'
    or (asset_row.uploaded_by is distinct from actor_id and not (select private.has_role('admin'::public.app_role))) then
    raise exception 'Only the uploader or an administrator may update a draft asset';
  end if;

  update public.content_assets
  set file_name = trim(p_file_name), file_size_bytes = p_file_size_bytes, processing_status = 'stored'
  where id = p_asset_id;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'content_asset.metadata_updated', 'content_asset', p_asset_id,
    jsonb_build_object('file_name', asset_row.file_name, 'file_size_bytes', asset_row.file_size_bytes),
    jsonb_build_object('file_name', trim(p_file_name), 'file_size_bytes', p_file_size_bytes));
  return true;
end;
$$;

revoke all on function public.update_question_asset_file_details(uuid, text, bigint) from public, anon;
grant execute on function public.update_question_asset_file_details(uuid, text, bigint) to authenticated;

create or replace function public.unlink_question_asset(
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
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  select q.* into question_row from public.questions q where q.id = p_question_id for update;
  if not found or question_row.status <> 'draft'
    or (question_row.authored_by <> actor_id and not (select private.has_role('admin'::public.app_role))) then
    raise exception 'Only the author or an administrator may unlink media from a draft question';
  end if;

  delete from public.question_assets qa
  where qa.question_id = p_question_id and qa.asset_id = p_asset_id and qa.purpose = p_purpose;
  if not found then raise exception 'The selected question media link no longer exists'; end if;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'content_asset.unlinked_from_draft', 'question_asset', p_question_id,
    jsonb_build_object('asset_id', p_asset_id, 'purpose', p_purpose), jsonb_build_object('unlinked', true));
  return true;
end;
$$;

revoke all on function public.unlink_question_asset(uuid, uuid, text) from public, anon;
grant execute on function public.unlink_question_asset(uuid, uuid, text) to authenticated;

create or replace function public.request_question_asset_delete(p_asset_id uuid)
returns text
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
  select ca.* into asset_row from public.content_assets ca where ca.id = p_asset_id for update;
  if not found or asset_row.status not in ('draft', 'retired')
    or (asset_row.uploaded_by is distinct from actor_id and not (select private.has_role('admin'::public.app_role))) then
    raise exception 'Only the uploader or an administrator may remove an unused draft asset';
  end if;
  if exists (select 1 from public.question_assets qa where qa.asset_id = p_asset_id) then
    raise exception 'Unlink this asset from every draft question before deleting its file';
  end if;

  if asset_row.status = 'draft' then
    update public.content_assets set status = 'retired' where id = p_asset_id;
    insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (actor_id, 'content_asset.archived_for_file_deletion', 'content_asset', p_asset_id,
      jsonb_build_object('status', asset_row.status), jsonb_build_object('status', 'retired', 'storage_path', asset_row.storage_path));
  end if;
  return asset_row.storage_path;
end;
$$;

revoke all on function public.request_question_asset_delete(uuid) from public, anon;
grant execute on function public.request_question_asset_delete(uuid) to authenticated;

create or replace function private.prevent_retired_question_asset_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  asset_status public.content_status;
begin
  select ca.status into asset_status
  from public.content_assets ca
  where ca.id = new.asset_id
  for share;
  if not found or asset_status = 'retired' then
    raise exception 'Archived media cannot be linked to a question';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_retired_question_asset_link on public.question_assets;
create trigger prevent_retired_question_asset_link
before insert or update of asset_id on public.question_assets
for each row execute function private.prevent_retired_question_asset_link();

drop policy if exists "JLPT editors delete own draft question assets" on storage.objects;
create policy "JLPT editors delete unused draft or retired question assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'jlpt-question-assets'
    and (
      exists (
        select 1 from public.content_assets ca
        where ca.storage_path = name
          and (ca.uploaded_by = (select auth.uid()) or (select private.has_role('admin'::public.app_role)))
          and ca.status = 'draft'
          and not exists (select 1 from public.question_assets qa where qa.asset_id = ca.id)
      )
      or exists (
        select 1 from public.content_assets ca
        where ca.storage_path = name
          and (ca.uploaded_by = (select auth.uid()) or (select private.has_role('admin'::public.app_role)))
          and ca.status = 'retired'
          and not exists (select 1 from public.question_assets qa where qa.asset_id = ca.id)
      )
      or (
        not exists (select 1 from public.content_assets ca where ca.storage_path = name)
        and split_part(name, '/', 1) = (select auth.uid())::text
        and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
      )
    )
  );

commit;
