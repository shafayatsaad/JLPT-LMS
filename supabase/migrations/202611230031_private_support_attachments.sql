-- Optional, private screenshot attachments for public support replies.
-- Images are normalized in the server route before storage; this migration
-- does not add external malware scanning or a retention/deletion schedule.

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.support_messages(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  status text not null default 'uploading' check (status in ('uploading', 'attached')),
  stored_bytes integer,
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  check (stored_bytes is null or stored_bytes between 1 and 4194304)
);

create index if not exists support_attachments_ticket_idx
  on public.support_attachments (ticket_id, created_at desc);

alter table public.support_attachments enable row level security;
alter table public.support_attachments force row level security;
revoke all on public.support_attachments from public, anon, authenticated;
grant select on public.support_attachments to authenticated;

drop policy if exists "support attachments: owner or staff reads metadata" on public.support_attachments;
create policy "support attachments: owner or staff reads metadata"
  on public.support_attachments
  for select to authenticated
  using (
    (select private.can_manage_support())
    or exists (
      select 1
      from public.support_messages m
      join public.support_tickets t on t.id = m.ticket_id
      where m.id = support_attachments.message_id
        and m.ticket_id = support_attachments.ticket_id
        and not m.is_internal
        and t.user_id = (select auth.uid())
    )
  );

alter table public.support_audit_events drop constraint if exists support_audit_events_action_check;
alter table public.support_audit_events
  add constraint support_audit_events_action_check
  check (action in ('student_reply', 'staff_reply', 'status_changed', 'attachment_uploaded', 'attachment_viewed'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jlpt-support-attachments', 'jlpt-support-attachments', false, 4194304, array['image/webp']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support attachments: owner or staff reads objects" on storage.objects;
create policy "support attachments: owner or staff reads objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'jlpt-support-attachments'
    and exists (
      select 1 from public.support_attachments a
      where a.storage_path = name and a.status = 'attached'
        and exists (
          select 1 from public.support_messages m
          where m.id = a.message_id and m.ticket_id = a.ticket_id and not m.is_internal
        )
        and (
          (select private.can_manage_support())
          or exists (
            select 1 from public.support_tickets t
            where t.id = a.ticket_id and t.user_id = (select auth.uid())
          )
        )
    )
  );

-- File writes go through server routes that validate/re-encode the image.
-- Remove the earlier receipt route's direct user upload/remove policies too.
drop policy if exists "support attachments: uploader adds reserved object" on storage.objects;
drop policy if exists "support attachments: uploader replaces reserved object" on storage.objects;
drop policy if exists "support attachments: uploader removes reserved object" on storage.objects;
drop policy if exists "payment receipts: owner uploads reserved file" on storage.objects;
drop policy if exists "payment receipts: owner removes unfinished upload" on storage.objects;

create or replace function public.begin_support_attachment_upload(
  p_message_id uuid,
  p_file_bytes bigint,
  p_media_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  message_ticket_id uuid;
  ticket_owner_id uuid;
  message_is_internal boolean;
  actor_is_staff boolean;
  attachment_row public.support_attachments%rowtype;
begin
  if actor_id is null then raise exception 'Sign in before attaching an image'; end if;
  if p_file_bytes is null or p_file_bytes not between 1 and 4194304 then raise exception 'Attachment must be 4 MB or smaller'; end if;
  if lower(coalesce(p_media_type, '')) not in ('image/png', 'image/jpeg', 'image/webp') then
    raise exception 'Only PNG, JPEG and WebP screenshots are accepted';
  end if;

  select m.ticket_id, t.user_id, m.is_internal
  into message_ticket_id, ticket_owner_id, message_is_internal
  from public.support_messages m
  join public.support_tickets t on t.id = m.ticket_id
  where m.id = p_message_id;
  if not found or message_is_internal then raise exception 'This support message cannot receive an attachment'; end if;

  actor_is_staff := (select private.can_manage_support());
  if ticket_owner_id <> actor_id and not actor_is_staff then raise exception 'You cannot attach a file to this request'; end if;

  select * into attachment_row
  from public.support_attachments
  where message_id = p_message_id
  for update;
  if found then
    if attachment_row.status = 'attached' then
      return jsonb_build_object('id', attachment_row.id, 'storage_path', attachment_row.storage_path, 'attached', true);
    end if;
    if attachment_row.created_at > now() - interval '30 minutes' then
      raise exception 'An attachment upload is already reserved for this message';
    end if;
    update public.support_attachments
    set uploaded_by = actor_id, created_at = now()
    where id = attachment_row.id
    returning * into attachment_row;
  else
    insert into public.support_attachments (message_id, ticket_id, uploaded_by, storage_path)
    values (p_message_id, message_ticket_id, actor_id, actor_id::text || '/' || gen_random_uuid()::text || '.webp')
    returning * into attachment_row;
  end if;

  return jsonb_build_object('id', attachment_row.id, 'storage_path', attachment_row.storage_path);
end;
$$;

create or replace function public.complete_support_attachment_upload(p_attachment_id uuid, p_stored_bytes integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attachment_row public.support_attachments%rowtype;
  actor_is_staff boolean;
  ticket_owner_id uuid;
begin
  if actor_id is null then raise exception 'Sign in before completing an attachment'; end if;
  if p_stored_bytes is null or p_stored_bytes not between 1 and 4194304 then raise exception 'Normalized image size is invalid'; end if;
  select * into attachment_row from public.support_attachments where id = p_attachment_id for update;
  if not found or attachment_row.status <> 'uploading' then raise exception 'The attachment reservation is unavailable'; end if;
  actor_is_staff := (select private.can_manage_support());
  select t.user_id into ticket_owner_id from public.support_tickets t where t.id = attachment_row.ticket_id;
  if attachment_row.uploaded_by <> actor_id
    or (ticket_owner_id <> actor_id and not actor_is_staff)
    or not exists (
    select 1 from public.support_messages m
    where m.id = attachment_row.message_id and m.ticket_id = attachment_row.ticket_id and not m.is_internal
  ) then raise exception 'You cannot complete this attachment'; end if;
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'jlpt-support-attachments' and so.name = attachment_row.storage_path
  ) then raise exception 'The attachment object is not available'; end if;

  update public.support_attachments
  set status = 'attached', stored_bytes = p_stored_bytes, attached_at = now()
  where id = p_attachment_id;

  insert into public.support_audit_events (ticket_id, actor_user_id, action, details)
  values (attachment_row.ticket_id, actor_id, 'attachment_uploaded',
    jsonb_build_object('message_id', attachment_row.message_id, 'attachment_id', attachment_row.id, 'stored_bytes', p_stored_bytes));
  return true;
end;
$$;

create or replace function public.clear_support_attachment_upload(p_attachment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Sign in before clearing an attachment'; end if;
  delete from public.support_attachments
  where id = p_attachment_id and uploaded_by = actor_id and status = 'uploading';
  return found;
end;
$$;

create or replace function public.get_support_attachment_storage_path(p_message_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  attachment_row public.support_attachments%rowtype;
  ticket_owner_id uuid;
  actor_is_staff boolean;
begin
  if actor_id is null then raise exception 'Sign in before opening an attachment'; end if;
  select a.* into attachment_row
  from public.support_attachments a
  where a.message_id = p_message_id and a.status = 'attached';
  if not found then raise exception 'Attachment not found'; end if;
  select t.user_id into ticket_owner_id from public.support_tickets t where t.id = attachment_row.ticket_id;
  actor_is_staff := (select private.can_manage_support());
  if ticket_owner_id <> actor_id and not actor_is_staff then raise exception 'You cannot open this attachment'; end if;
  if exists (select 1 from public.support_messages m where m.id = p_message_id and m.is_internal) then
    raise exception 'Internal-message attachments are unavailable';
  end if;

  insert into public.support_audit_events (ticket_id, actor_user_id, action, details)
  values (attachment_row.ticket_id, actor_id, 'attachment_viewed',
    jsonb_build_object('message_id', p_message_id, 'attachment_id', attachment_row.id));
  return attachment_row.storage_path;
end;
$$;

revoke all on function public.begin_support_attachment_upload(uuid, bigint, text) from public, anon;
revoke all on function public.complete_support_attachment_upload(uuid, integer) from public, anon;
revoke all on function public.clear_support_attachment_upload(uuid) from public, anon;
revoke all on function public.get_support_attachment_storage_path(uuid) from public, anon;
grant execute on function public.begin_support_attachment_upload(uuid, bigint, text) to authenticated;
grant execute on function public.complete_support_attachment_upload(uuid, integer) to authenticated;
grant execute on function public.clear_support_attachment_upload(uuid) to authenticated;
grant execute on function public.get_support_attachment_storage_path(uuid) to authenticated;
