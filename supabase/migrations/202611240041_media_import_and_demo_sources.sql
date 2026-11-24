begin;

-- The question-media bucket supports the source MP3s supplied for local testing.
update storage.buckets
set file_size_limit = 52428800
where id = 'jlpt-question-assets';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jlpt-demo-source-materials',
  'jlpt-demo-source-materials',
  false,
  104857600,
  array['application/pdf', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "JLPT staff read private demo source materials" on storage.objects;
create policy "JLPT staff read private demo source materials"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'jlpt-demo-source-materials'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "JLPT editors upload private demo source materials" on storage.objects;
create policy "JLPT editors upload private demo source materials"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'jlpt-demo-source-materials'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "JLPT editors update private demo source materials" on storage.objects;
create policy "JLPT editors update private demo source materials"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'jlpt-demo-source-materials'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  )
  with check (
    bucket_id = 'jlpt-demo-source-materials'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

drop policy if exists "JLPT editors delete private demo source materials" on storage.objects;
create policy "JLPT editors delete private demo source materials"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'jlpt-demo-source-materials'
    and (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role]))
  );

create table public.demo_source_packets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  level public.jlpt_level not null,
  release_label text not null check (char_length(trim(release_label)) between 2 and 100),
  source_kind text not null check (source_kind in ('practice_paper', 'layout_reference')),
  pdf_path text not null unique,
  pdf_file_name text not null check (char_length(pdf_file_name) between 1 and 240),
  pdf_bytes bigint not null check (pdf_bytes between 1 and 104857600),
  audio_path text unique,
  audio_file_name text,
  audio_media_type text,
  audio_bytes bigint,
  rights_status text not null default 'unconfirmed'
    check (rights_status in ('unconfirmed', 'licensed', 'permission_granted', 'public_domain')),
  rights_notes text not null check (char_length(trim(rights_notes)) between 10 and 2000),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (
    (audio_path is null and audio_file_name is null and audio_media_type is null and audio_bytes is null)
    or
    (audio_path is not null and audio_file_name is not null and audio_media_type in ('audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm') and audio_bytes between 1 and 52428800)
  )
);

create index demo_source_packets_level_created_idx
  on public.demo_source_packets (level, created_at desc)
  where archived_at is null;

alter table public.demo_source_packets enable row level security;
revoke all on public.demo_source_packets from public, anon, authenticated;
grant select on public.demo_source_packets to authenticated;

create policy "Demo source packets: staff can read"
  on public.demo_source_packets for select to authenticated
  using ((select private.has_any_role(array['content_editor'::public.app_role, 'reviewer'::public.app_role, 'admin'::public.app_role])));

create or replace function public.create_demo_source_packet(
  p_title text,
  p_level public.jlpt_level,
  p_release_label text,
  p_source_kind text,
  p_pdf_path text,
  p_pdf_file_name text,
  p_pdf_bytes bigint,
  p_audio_path text,
  p_audio_file_name text,
  p_audio_media_type text,
  p_audio_bytes bigint,
  p_rights_status text,
  p_rights_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  packet_id uuid;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_pdf_path is null or split_part(p_pdf_path, '/', 1) <> actor_id::text
    or p_pdf_path !~* '\.pdf$'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'jlpt-demo-source-materials' and o.name = p_pdf_path)
  then raise exception 'Upload a PDF to your private source-material workspace first'; end if;
  if p_audio_path is not null and (
    split_part(p_audio_path, '/', 1) <> actor_id::text
    or p_audio_media_type not in ('audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm')
    or not exists (select 1 from storage.objects o where o.bucket_id = 'jlpt-demo-source-materials' and o.name = p_audio_path)
  ) then raise exception 'The selected audio file is missing or unsupported'; end if;
  if p_rights_status = 'unconfirmed' and length(trim(coalesce(p_rights_notes, ''))) < 10 then
    raise exception 'Unconfirmed source material needs a private-use rights note'; end if;

  insert into public.demo_source_packets (
    title, level, release_label, source_kind, pdf_path, pdf_file_name, pdf_bytes,
    audio_path, audio_file_name, audio_media_type, audio_bytes,
    rights_status, rights_notes, uploaded_by
  ) values (
    trim(p_title), p_level, trim(p_release_label), p_source_kind, p_pdf_path, p_pdf_file_name, p_pdf_bytes,
    p_audio_path, p_audio_file_name, p_audio_media_type, p_audio_bytes,
    p_rights_status, trim(p_rights_notes), actor_id
  ) returning id into packet_id;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (
    actor_id,
    'demo_source_packet.created',
    'demo_source_packet',
    packet_id,
    jsonb_build_object('level', p_level, 'source_kind', p_source_kind, 'rights_status', p_rights_status, 'local_demo_only', true)
  );
  return packet_id;
end;
$$;

revoke all on function public.create_demo_source_packet(text, public.jlpt_level, text, text, text, text, bigint, text, text, text, bigint, text, text) from public, anon;
grant execute on function public.create_demo_source_packet(text, public.jlpt_level, text, text, text, text, bigint, text, text, text, bigint, text, text) to authenticated;

create or replace function public.archive_demo_source_packet(p_packet_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator role required';
  end if;
  update public.demo_source_packets
  set archived_at = now()
  where id = p_packet_id and archived_at is null;
  if not found then return false; end if;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id)
  values (actor_id, 'demo_source_packet.archived', 'demo_source_packet', p_packet_id);
  return true;
end;
$$;

revoke all on function public.archive_demo_source_packet(uuid) from public, anon;
grant execute on function public.archive_demo_source_packet(uuid) to authenticated;

create or replace function public.register_question_assets_batch(p_assets jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  item jsonb;
  question_id_value uuid;
  asset_path text;
  media_type_value text;
  purpose_value text;
  duration_value numeric;
  question_row public.questions%rowtype;
  asset_id_value uuid;
  result_ids uuid[] := array[]::uuid[];
  asset_count integer;
begin
  if actor_id is null or not (select private.has_any_role(array['content_editor'::public.app_role, 'admin'::public.app_role])) then
    raise exception 'Content editor role required';
  end if;
  if p_assets is null or jsonb_typeof(p_assets) <> 'array' then raise exception 'Media attachment list must be an array'; end if;
  asset_count := jsonb_array_length(p_assets);
  if asset_count > 500 then raise exception 'A media import can attach at most 500 file references'; end if;

  for item in select value from jsonb_array_elements(p_assets)
  loop
    question_id_value := nullif(item ->> 'question_id', '')::uuid;
    asset_path := nullif(trim(item ->> 'storage_path'), '');
    media_type_value := item ->> 'media_type';
    purpose_value := trim(coalesce(item ->> 'purpose', ''));
    duration_value := nullif(item ->> 'duration_seconds', '')::numeric;

    select q.* into question_row
    from public.questions q
    where q.id = question_id_value and q.authored_by = actor_id
    for update;
    if not found or question_row.status <> 'draft' then raise exception 'Assets can only be attached to your own draft questions'; end if;
    if asset_path is null or split_part(asset_path, '/', 1) <> actor_id::text or length(asset_path) > 1024 then
      raise exception 'Media must be stored inside the current editor private workspace'; end if;
    if media_type_value not in ('audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Unsupported question media type'; end if;
    if purpose_value not in ('question_audio', 'question_image', 'stimulus_audio', 'stimulus_image') then
      raise exception 'Unsupported question media purpose'; end if;
    if duration_value is not null and (duration_value <= 0 or duration_value > 7200) then
      raise exception 'Audio duration is outside the supported range'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'jlpt-question-assets' and o.name = asset_path) then
      raise exception 'A selected media file is missing from private storage'; end if;

    select ca.id into asset_id_value
    from public.content_assets ca
    where ca.storage_path = asset_path and ca.uploaded_by = actor_id and ca.status = 'draft'
    for update;
    if asset_id_value is null then
      insert into public.content_assets (storage_path, media_type, duration_seconds, status, uploaded_by)
      values (asset_path, media_type_value, duration_value, 'draft', actor_id)
      returning id into asset_id_value;
    elsif not exists (
      select 1 from public.content_assets ca
      where ca.id = asset_id_value and ca.media_type = media_type_value
        and ca.duration_seconds is not distinct from duration_value
    ) then
      raise exception 'An existing media path has different metadata'; end if;

    insert into public.question_assets (question_id, asset_id, purpose)
    values (question_id_value, asset_id_value, purpose_value)
    on conflict (question_id, asset_id, purpose) do nothing;
    result_ids := array_append(result_ids, asset_id_value);
  end loop;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'question.assets_batch_registered', 'question_asset_import',
    jsonb_build_object('attachment_count', asset_count, 'unique_asset_ids', to_jsonb(array(select distinct x from unnest(result_ids) x))));
  return result_ids;
end;
$$;

revoke all on function public.register_question_assets_batch(jsonb) from public, anon;
grant execute on function public.register_question_assets_batch(jsonb) to authenticated;

commit;
