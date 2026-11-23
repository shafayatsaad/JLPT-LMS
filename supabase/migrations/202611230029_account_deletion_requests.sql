-- Privacy-request intake and review tracking. This records requests only;
-- it never deletes an account or financial/audit records.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'received'
    check (status in ('received', 'under_review', 'awaiting_owner_policy', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_deletion_requests_created_idx
  on public.account_deletion_requests (created_at desc);

create unique index if not exists account_deletion_requests_one_open_per_user_idx
  on public.account_deletion_requests (user_id)
  where status in ('received', 'under_review', 'awaiting_owner_policy');

alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_requests force row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;

drop policy if exists "account deletion request owner reads own" on public.account_deletion_requests;
create policy "account deletion request owner reads own"
  on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.get_my_account_deletion_request()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.account_deletion_requests%rowtype;
begin
  if actor_id is null then raise exception 'Sign-in is required'; end if;
  select * into request_row
  from public.account_deletion_requests
  where user_id = actor_id
  order by created_at desc
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', request_row.id,
    'status', request_row.status,
    'created_at', request_row.created_at,
    'updated_at', request_row.updated_at
  );
end;
$$;

create or replace function public.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.account_deletion_requests%rowtype;
begin
  if actor_id is null then raise exception 'Sign-in is required'; end if;

  insert into public.account_deletion_requests (user_id)
  values (actor_id)
  on conflict (user_id) where status in ('received', 'under_review', 'awaiting_owner_policy')
  do nothing
  returning * into request_row;

  if not found then
    select * into request_row
    from public.account_deletion_requests
    where user_id = actor_id
      and status in ('received', 'under_review', 'awaiting_owner_policy')
    order by created_at desc
    limit 1;
  else
    insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
    values (actor_id, 'privacy.deletion_requested', 'account_deletion_request', request_row.id,
      jsonb_build_object('status', request_row.status));
  end if;

  if request_row.id is null then raise exception 'The privacy request could not be recorded'; end if;
  return jsonb_build_object(
    'id', request_row.id,
    'status', request_row.status,
    'created_at', request_row.created_at,
    'updated_at', request_row.updated_at
  );
end;
$$;

create or replace function public.withdraw_account_deletion_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.account_deletion_requests%rowtype;
begin
  if actor_id is null then raise exception 'Sign-in is required'; end if;
  update public.account_deletion_requests
  set status = 'withdrawn', updated_at = now()
  where id = p_request_id
    and user_id = actor_id
    and status in ('received', 'under_review', 'awaiting_owner_policy')
  returning * into request_row;

  if found then
    insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
    values (actor_id, 'privacy.deletion_request_withdrawn', 'account_deletion_request', request_row.id,
      jsonb_build_object('status', request_row.status));
  else
    select * into request_row from public.account_deletion_requests
    where id = p_request_id and user_id = actor_id and status = 'withdrawn';
    if not found then raise exception 'This request cannot be withdrawn'; end if;
  end if;

  return jsonb_build_object(
    'id', request_row.id,
    'status', request_row.status,
    'created_at', request_row.created_at,
    'updated_at', request_row.updated_at
  );
end;
$$;

create or replace function public.get_admin_account_deletion_requests(p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  status_value text := nullif(trim(coalesce(p_status, '')), '');
  requests_json jsonb;
  result_count integer;
begin
  if actor_id is null or not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Administrator access is required';
  end if;
  if status_value is not null and status_value not in ('received', 'under_review', 'awaiting_owner_policy', 'withdrawn') then
    raise exception 'Privacy-request status is invalid';
  end if;

  select coalesce(jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc), '[]'::jsonb), count(*)::integer
  into requests_json, result_count
  from (
    select
      r.id,
      r.user_id,
      p.display_name,
      u.email,
      r.status,
      r.created_at,
      r.updated_at
    from public.account_deletion_requests r
    left join public.profiles p on p.user_id = r.user_id
    left join auth.users u on u.id = r.user_id
    where status_value is null or r.status = status_value
    order by r.created_at desc
    limit 200
  ) as request_row;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'privacy.deletion_requests_viewed', 'account_deletion_request',
    jsonb_build_object('status_filter', status_value, 'row_count', result_count));
  return requests_json;
end;
$$;

create or replace function public.set_admin_account_deletion_request_status(
  p_request_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.account_deletion_requests%rowtype;
  before_status text;
begin
  if actor_id is null or not (select private.has_role('admin'::public.app_role)) then
    raise exception 'Administrator access is required';
  end if;
  if p_status not in ('received', 'under_review', 'awaiting_owner_policy') then
    raise exception 'Administrators may update open requests only';
  end if;

  select status into before_status from public.account_deletion_requests
  where id = p_request_id and status <> 'withdrawn'
  for update;
  if not found then raise exception 'This open request is unavailable'; end if;

  update public.account_deletion_requests
  set status = p_status, updated_at = now()
  where id = p_request_id and status <> 'withdrawn'
  returning * into request_row;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'privacy.deletion_request_status_changed', 'account_deletion_request', request_row.id,
    jsonb_build_object('status', before_status), jsonb_build_object('status', request_row.status));

  return jsonb_build_object(
    'id', request_row.id,
    'status', request_row.status,
    'created_at', request_row.created_at,
    'updated_at', request_row.updated_at
  );
end;
$$;

revoke all on function public.get_my_account_deletion_request() from public, anon;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.withdraw_account_deletion_request(uuid) from public, anon;
revoke all on function public.get_admin_account_deletion_requests(text) from public, anon;
revoke all on function public.set_admin_account_deletion_request_status(uuid, text) from public, anon;
grant execute on function public.get_my_account_deletion_request() to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.withdraw_account_deletion_request(uuid) to authenticated;
grant execute on function public.get_admin_account_deletion_requests(text) to authenticated;
grant execute on function public.set_admin_account_deletion_request_status(uuid, text) to authenticated;
