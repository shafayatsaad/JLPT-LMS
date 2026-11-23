-- Store optional learner notification preferences without suppressing required notices.
-- Apply after migrations 001 through 017.

begin;

create table public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_exam_updates boolean not null default true,
  in_app_service_announcements boolean not null default true,
  email_learning_updates boolean not null default false,
  email_product_news boolean not null default false,
  email_learning_opted_in_at timestamptz,
  email_product_opted_in_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;
revoke all on public.user_notification_preferences from anon, authenticated;

create or replace function public.get_my_notification_preferences()
returns table (
  in_app_exam_updates boolean,
  in_app_service_announcements boolean,
  email_learning_updates boolean,
  email_product_news boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Sign in to view notification preferences'; end if;
  return query
  select
    coalesce(p.in_app_exam_updates, true),
    coalesce(p.in_app_service_announcements, true),
    coalesce(p.email_learning_updates, false),
    coalesce(p.email_product_news, false),
    p.updated_at
  from (select actor_id as user_id) current_user_row
  left join public.user_notification_preferences p on p.user_id = current_user_row.user_id;
end;
$$;

revoke all on function public.get_my_notification_preferences() from public, anon;
grant execute on function public.get_my_notification_preferences() to authenticated;

create or replace function public.save_my_notification_preferences(
  p_in_app_exam_updates boolean,
  p_in_app_service_announcements boolean,
  p_email_learning_updates boolean,
  p_email_product_news boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  saved_at timestamptz := clock_timestamp();
begin
  if actor_id is null then raise exception 'Sign in to update notification preferences'; end if;
  if p_in_app_exam_updates is null or p_in_app_service_announcements is null
    or p_email_learning_updates is null or p_email_product_news is null then
    raise exception 'Choose a value for each optional notification preference';
  end if;

  insert into public.user_notification_preferences (
    user_id, in_app_exam_updates, in_app_service_announcements,
    email_learning_updates, email_product_news,
    email_learning_opted_in_at, email_product_opted_in_at, updated_at
  ) values (
    actor_id, p_in_app_exam_updates, p_in_app_service_announcements,
    p_email_learning_updates, p_email_product_news,
    case when p_email_learning_updates then saved_at else null end,
    case when p_email_product_news then saved_at else null end,
    saved_at
  )
  on conflict (user_id) do update set
    in_app_exam_updates = excluded.in_app_exam_updates,
    in_app_service_announcements = excluded.in_app_service_announcements,
    email_learning_updates = excluded.email_learning_updates,
    email_product_news = excluded.email_product_news,
    email_learning_opted_in_at = case
      when excluded.email_learning_updates then coalesce(public.user_notification_preferences.email_learning_opted_in_at, excluded.email_learning_opted_in_at)
      else null
    end,
    email_product_opted_in_at = case
      when excluded.email_product_news then coalesce(public.user_notification_preferences.email_product_opted_in_at, excluded.email_product_opted_in_at)
      else null
    end,
    updated_at = excluded.updated_at;
  return saved_at;
end;
$$;

revoke all on function public.save_my_notification_preferences(boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_my_notification_preferences(boolean, boolean, boolean, boolean) to authenticated;

comment on table public.user_notification_preferences is
  'Learner-owned optional notification preferences. Security, payment and other required account notices are not controlled here.';

commit;
