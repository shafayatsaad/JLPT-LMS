-- Student support inbox and in-app notifications.
-- Apply after migrations 001-004.

alter type public.app_role add value if not exists 'support_agent';

begin;

create or replace function private.can_manage_support()
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
      and ur.role::text in ('admin', 'support_agent')
  );
$$;

revoke all on function private.can_manage_support() from public, anon;
grant execute on function private.can_manage_support() to authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'email_verification', 'security_notice', 'payment_submitted', 'payment_approved',
    'payment_rejected', 'premium_activated', 'premium_expiring', 'premium_expired',
    'exam_published', 'exam_updated', 'attempt_submitted', 'result_ready',
    'support_reply', 'support_update', 'service_announcement', 'generic'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1000),
  href text check (href is null or (left(href, 1) = '/' and left(href, 2) <> '//')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'payment', 'account', 'exam_issue', 'content_issue', 'technical_issue', 'other'
  )),
  subject text not null check (char_length(subject) between 5 and 120),
  status text not null default 'open' check (status in (
    'open', 'in_progress', 'waiting_for_student', 'resolved', 'closed'
  )),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index support_tickets_user_updated_idx
  on public.support_tickets (user_id, updated_at desc);
create index support_tickets_queue_idx
  on public.support_tickets (status, last_message_at asc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sender_side text not null check (sender_side in ('student', 'staff')),
  body text not null check (char_length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index support_messages_ticket_created_idx
  on public.support_messages (ticket_id, created_at asc);

create table public.support_audit_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('student_reply', 'staff_reply', 'status_changed')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index support_audit_ticket_created_idx
  on public.support_audit_events (ticket_id, created_at desc);

create trigger support_audit_append_only
  before update or delete on public.support_audit_events
  for each row execute function public.prevent_audit_event_mutation();

alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_audit_events enable row level security;

revoke all on public.notifications, public.support_tickets,
  public.support_messages, public.support_audit_events from anon, authenticated;
grant select on public.notifications, public.support_tickets,
  public.support_messages, public.support_audit_events to authenticated;

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "support tickets: owner or support staff read"
  on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select private.can_manage_support()));

create policy "support messages: owner sees public messages; staff sees all"
  on public.support_messages for select to authenticated
  using (
    (select private.can_manage_support())
    or (
      not is_internal
      and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = (select auth.uid())
      )
    )
  );

create policy "support audit: support staff read"
  on public.support_audit_events for select to authenticated
  using ((select private.can_manage_support()));

create or replace function public.create_support_ticket(
  p_category text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  ticket_id uuid;
  category_value text := lower(trim(coalesce(p_category, '')));
  subject_value text := trim(coalesce(p_subject, ''));
  body_value text := trim(coalesce(p_body, ''));
begin
  if actor_id is null then raise exception 'Sign in before contacting support'; end if;
  if category_value not in ('payment', 'account', 'exam_issue', 'content_issue', 'technical_issue', 'other') then
    raise exception 'Choose a valid support category';
  end if;
  if char_length(subject_value) not between 5 and 120 then
    raise exception 'Subject must be between 5 and 120 characters';
  end if;
  if char_length(body_value) not between 10 and 5000 then
    raise exception 'Description must be between 10 and 5000 characters';
  end if;

  insert into public.support_tickets (user_id, category, subject)
  values (actor_id, category_value, subject_value)
  returning id into ticket_id;

  insert into public.support_messages (ticket_id, sender_user_id, sender_side, body)
  values (ticket_id, actor_id, 'student', body_value);

  insert into public.support_audit_events (ticket_id, actor_user_id, action)
  values (ticket_id, actor_id, 'student_reply');

  return ticket_id;
end;
$$;

create or replace function public.reply_support_ticket(
  p_ticket_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  owner_id uuid;
  current_status text;
  staff_reply boolean;
  body_value text := trim(coalesce(p_body, ''));
  message_id uuid;
  new_status text;
begin
  if actor_id is null then raise exception 'Sign in before replying'; end if;
  if char_length(body_value) not between 1 and 5000 then
    raise exception 'Message must be between 1 and 5000 characters';
  end if;

  select t.user_id, t.status into owner_id, current_status
  from public.support_tickets t
  where t.id = p_ticket_id
  for update;
  if not found then raise exception 'Support request not found'; end if;

  staff_reply := (select private.can_manage_support());
  if not staff_reply and owner_id <> actor_id then
    raise exception 'You cannot reply to this support request';
  end if;

  if staff_reply then
    new_status := 'waiting_for_student';
  elsif current_status in ('resolved', 'closed') then
    new_status := 'open';
  else
    new_status := 'in_progress';
  end if;

  insert into public.support_messages (ticket_id, sender_user_id, sender_side, body)
  values (p_ticket_id, actor_id, case when staff_reply then 'staff' else 'student' end, body_value)
  returning id into message_id;

  update public.support_tickets
  set status = new_status,
      last_message_at = now(),
      updated_at = now(),
      closed_at = null
  where id = p_ticket_id;

  insert into public.support_audit_events (ticket_id, actor_user_id, action)
  values (p_ticket_id, actor_id, case when staff_reply then 'staff_reply' else 'student_reply' end);

  if staff_reply then
    insert into public.notifications (user_id, notification_type, title, body, href)
    values (
      owner_id,
      'support_reply',
      'Support team replied',
      'A response was added to your support request.',
      '/support/' || p_ticket_id::text
    );
  end if;

  return message_id;
end;
$$;

create or replace function public.set_support_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  owner_id uuid;
  previous_status text;
  note_value text := nullif(trim(coalesce(p_note, '')), '');
begin
  if actor_id is null or not (select private.can_manage_support()) then
    raise exception 'Support staff access is required';
  end if;
  if p_status not in ('open', 'in_progress', 'waiting_for_student', 'resolved', 'closed') then
    raise exception 'Choose a valid support status';
  end if;
  if note_value is not null and char_length(note_value) > 1000 then
    raise exception 'Status note is too long';
  end if;

  select t.user_id, t.status into owner_id, previous_status
  from public.support_tickets t
  where t.id = p_ticket_id
  for update;
  if not found then raise exception 'Support request not found'; end if;
  if previous_status = p_status then return true; end if;

  update public.support_tickets
  set status = p_status,
      updated_at = now(),
      closed_at = case when p_status = 'closed' then now() else null end
  where id = p_ticket_id;

  insert into public.support_audit_events (ticket_id, actor_user_id, action, details)
  values (
    p_ticket_id,
    actor_id,
    'status_changed',
    jsonb_build_object('from', previous_status, 'to', p_status, 'note', note_value)
  );

  insert into public.notifications (user_id, notification_type, title, body, href)
  values (
    owner_id,
    'support_update',
    'Support request updated',
    'Your support request status is now ' || replace(p_status, '_', ' ') || '.',
    '/support/' || p_ticket_id::text
  );

  return true;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = (select auth.uid());
  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if (select auth.uid()) is null then return 0; end if;
  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid()) and read_at is null;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

revoke all on function public.create_support_ticket(text, text, text) from public, anon;
revoke all on function public.reply_support_ticket(uuid, text) from public, anon;
revoke all on function public.set_support_ticket_status(uuid, text, text) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.create_support_ticket(text, text, text) to authenticated;
grant execute on function public.reply_support_ticket(uuid, text) to authenticated;
grant execute on function public.set_support_ticket_status(uuid, text, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

commit;
