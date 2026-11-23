-- Create one learner-owned in-app notice when an exam result is finalized.
-- Optional exam updates honor the learner's in-app exam preference.
-- Apply after migrations 001 through 020.

begin;

alter table public.notifications
  add column source_attempt_id uuid references public.exam_attempts(id) on delete cascade;

create unique index notifications_attempt_result_unique
  on public.notifications (user_id, source_attempt_id)
  where source_attempt_id is not null;

create or replace function private.notify_exam_result_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_owner uuid;
  exam_level text;
begin
  select a.user_id, a.level
  into attempt_owner, exam_level
  from public.exam_attempts a
  where a.id = new.attempt_id;

  if attempt_owner is null then
    return new;
  end if;

  if exists (
    select 1
    from public.user_notification_preferences p
    where p.user_id = attempt_owner
      and not p.in_app_exam_updates
  ) then
    return new;
  end if;

  insert into public.notifications (
    user_id, notification_type, title, body, href,
    title_bn, body_bn, source_attempt_id
  ) values (
    attempt_owner,
    'result_ready',
    'Your ' || exam_level || ' exam result is ready',
    'Your raw result and completed answer review are available.',
    '/results/' || new.attempt_id::text,
    exam_level || ' পরীক্ষার ফলাফল প্রস্তুত',
    'আপনার কাঁচা ফলাফল ও সম্পূর্ণ উত্তর পর্যালোচনা এখন পাওয়া যাচ্ছে।',
    new.attempt_id
  )
  on conflict (user_id, source_attempt_id)
    where source_attempt_id is not null do nothing;

  return new;
end;
$$;

revoke all on function private.notify_exam_result_ready() from public, anon, authenticated;

create trigger exam_result_ready_notification
  after insert on public.exam_results
  for each row execute function private.notify_exam_result_ready();

comment on column public.notifications.source_attempt_id is
  'Exam attempt that produced a result-ready notice; unique per learner and attempt for idempotent delivery.';

commit;
