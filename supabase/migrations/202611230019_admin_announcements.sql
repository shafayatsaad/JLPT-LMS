-- Add a bilingual, audited in-app announcement workflow for administrators.
-- Optional notices respect each learner's service-announcement preference.
-- Apply after migrations 001 through 018.

begin;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_en text not null check (char_length(trim(title_en)) between 1 and 120),
  title_bn text not null check (char_length(trim(title_bn)) between 1 and 120),
  body_en text not null check (char_length(trim(body_en)) between 1 and 1000),
  body_bn text not null check (char_length(trim(body_bn)) between 1 and 1000),
  href text check (href is null or (left(href, 1) = '/' and left(href, 2) <> '//' and position(chr(92) in href) = 0)),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check ((status = 'draft' and published_by is null and published_at is null)
      or (status = 'published' and published_by is not null and published_at is not null))
);

alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;

alter table public.notifications
  add column title_bn text,
  add column body_bn text,
  add column source_announcement_id uuid references public.announcements(id) on delete restrict,
  add constraint notifications_bilingual_content_check check (
    (title_bn is null and body_bn is null)
    or (title_bn is not null and body_bn is not null
      and char_length(title_bn) between 1 and 120
      and char_length(body_bn) between 1 and 1000)
  );

create unique index notifications_announcement_recipient_unique
  on public.notifications (user_id, source_announcement_id)
  where source_announcement_id is not null;

create index announcements_status_created_idx
  on public.announcements (status, created_at desc);

create or replace function public.list_admin_announcements()
returns table (
  id uuid,
  title_en text,
  title_bn text,
  body_en text,
  body_bn text,
  href text,
  status text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  published_by uuid,
  published_at timestamptz,
  recipient_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;

  return query
  select a.id, a.title_en, a.title_bn, a.body_en, a.body_bn, a.href,
    a.status, a.created_by, a.created_at, a.updated_at, a.published_by, a.published_at,
    count(n.id)::bigint
  from public.announcements a
  left join public.notifications n on n.source_announcement_id = a.id
  group by a.id
  order by a.created_at desc;
end;
$$;

revoke all on function public.list_admin_announcements() from public, anon;
grant execute on function public.list_admin_announcements() to authenticated;

create or replace function public.create_admin_announcement_draft(
  p_title_en text,
  p_title_bn text,
  p_body_en text,
  p_body_bn text,
  p_href text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  announcement_id uuid;
  safe_href text := nullif(trim(coalesce(p_href, '')), '');
  title_en_value text := trim(coalesce(p_title_en, ''));
  title_bn_value text := trim(coalesce(p_title_bn, ''));
  body_en_value text := trim(coalesce(p_body_en, ''));
  body_bn_value text := trim(coalesce(p_body_bn, ''));
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  if char_length(title_en_value) not between 1 and 120 or char_length(title_bn_value) not between 1 and 120
    or char_length(body_en_value) not between 1 and 1000 or char_length(body_bn_value) not between 1 and 1000 then
    raise exception 'Provide both language versions with valid title and message lengths';
  end if;
  if safe_href is not null and (left(safe_href, 1) <> '/' or left(safe_href, 2) = '//' or position(chr(92) in safe_href) > 0) then
    raise exception 'The announcement link must be an internal app path';
  end if;

  insert into public.announcements (title_en, title_bn, body_en, body_bn, href, created_by)
  values (title_en_value, title_bn_value, body_en_value, body_bn_value, safe_href, actor_id)
  returning id into announcement_id;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'announcement.draft_created', 'announcement', announcement_id,
    jsonb_build_object('title_en', title_en_value, 'title_bn', title_bn_value, 'href', safe_href, 'status', 'draft'));
  return announcement_id;
end;
$$;

revoke all on function public.create_admin_announcement_draft(text, text, text, text, text) from public, anon;
grant execute on function public.create_admin_announcement_draft(text, text, text, text, text) to authenticated;

create or replace function public.update_admin_announcement_draft(
  p_announcement_id uuid,
  p_title_en text,
  p_title_bn text,
  p_body_en text,
  p_body_bn text,
  p_href text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  announcement_row public.announcements%rowtype;
  safe_href text := nullif(trim(coalesce(p_href, '')), '');
  title_en_value text := trim(coalesce(p_title_en, ''));
  title_bn_value text := trim(coalesce(p_title_bn, ''));
  body_en_value text := trim(coalesce(p_body_en, ''));
  body_bn_value text := trim(coalesce(p_body_bn, ''));
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  if char_length(title_en_value) not between 1 and 120 or char_length(title_bn_value) not between 1 and 120
    or char_length(body_en_value) not between 1 and 1000 or char_length(body_bn_value) not between 1 and 1000 then
    raise exception 'Provide both language versions with valid title and message lengths';
  end if;
  if safe_href is not null and (left(safe_href, 1) <> '/' or left(safe_href, 2) = '//' or position(chr(92) in safe_href) > 0) then
    raise exception 'The announcement link must be an internal app path';
  end if;

  select a.* into announcement_row from public.announcements a
  where a.id = p_announcement_id for update;
  if not found or announcement_row.status <> 'draft' then
    raise exception 'Only an unpublished announcement draft can be edited';
  end if;

  update public.announcements
  set title_en = title_en_value, title_bn = title_bn_value,
      body_en = body_en_value, body_bn = body_bn_value,
      href = safe_href, updated_at = clock_timestamp()
  where id = p_announcement_id;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'announcement.draft_updated', 'announcement', p_announcement_id,
    jsonb_build_object('title_en', announcement_row.title_en, 'title_bn', announcement_row.title_bn,
      'body_en', announcement_row.body_en, 'body_bn', announcement_row.body_bn, 'href', announcement_row.href),
    jsonb_build_object('title_en', title_en_value, 'title_bn', title_bn_value,
      'body_en', body_en_value, 'body_bn', body_bn_value, 'href', safe_href));
  return true;
end;
$$;

revoke all on function public.update_admin_announcement_draft(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_admin_announcement_draft(uuid, text, text, text, text, text) to authenticated;

create or replace function public.publish_admin_announcement(p_announcement_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  announcement_row public.announcements%rowtype;
  recipient_count integer;
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;

  select a.* into announcement_row from public.announcements a
  where a.id = p_announcement_id for update;
  if not found then raise exception 'Announcement draft was not found'; end if;
  if announcement_row.status = 'published' then
    select count(*)::integer into recipient_count
    from public.notifications n where n.source_announcement_id = p_announcement_id;
    return recipient_count;
  end if;

  update public.announcements
  set status = 'published', published_by = actor_id,
      published_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_announcement_id;

  insert into public.notifications (
    user_id, notification_type, title, body, href,
    title_bn, body_bn, source_announcement_id
  )
  select
    ur.user_id, 'service_announcement', announcement_row.title_en,
    announcement_row.body_en, announcement_row.href,
    announcement_row.title_bn, announcement_row.body_bn, p_announcement_id
  from public.user_roles ur
  left join public.user_notification_preferences pref on pref.user_id = ur.user_id
  where ur.role = 'student'::public.app_role
    and coalesce(pref.in_app_service_announcements, true)
  on conflict (user_id, source_announcement_id) where source_announcement_id is not null do nothing;

  get diagnostics recipient_count = row_count;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'announcement.published', 'announcement', p_announcement_id,
    jsonb_build_object('title_en', announcement_row.title_en, 'title_bn', announcement_row.title_bn,
      'href', announcement_row.href, 'recipient_count', recipient_count));
  return recipient_count;
end;
$$;

revoke all on function public.publish_admin_announcement(uuid) from public, anon;
grant execute on function public.publish_admin_announcement(uuid) to authenticated;

comment on table public.announcements is
  'Bilingual admin-created in-app notices. Published content is immutable and delivery is recorded in notifications.';
comment on column public.notifications.source_announcement_id is
  'Announcement origin used to make broadcast delivery idempotent and auditable.';

commit;
