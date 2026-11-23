-- Retry-safe, server-only Google Sheets outbox and reconciliation for payments.
-- PostgreSQL remains authoritative; Sheets failures never change payment state.

begin;

create table private.payment_sheet_sync_jobs (
  payment_submission_id uuid primary key references public.payment_submissions(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  claimed_revision bigint,
  status text not null default 'queued' check (status in ('queued', 'syncing', 'synced', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now(),
  check ((status = 'syncing') = (lease_token is not null and lease_expires_at is not null))
);
create index payment_sheet_sync_jobs_due_idx
  on private.payment_sheet_sync_jobs (next_attempt_at, updated_at)
  where status in ('queued', 'syncing');
create index payment_sheet_sync_jobs_admin_idx
  on private.payment_sheet_sync_jobs (status, updated_at desc);

create table private.payment_sheet_sync_events (
  id bigint generated always as identity primary key,
  payment_submission_id uuid not null references public.payment_submissions(id) on delete cascade,
  revision bigint not null,
  attempt integer not null,
  status text not null check (status in ('synced', 'failed', 'superseded')),
  error_code text,
  occurred_at timestamptz not null default now()
);
create index payment_sheet_sync_events_payment_idx
  on private.payment_sheet_sync_events (payment_submission_id, occurred_at desc);
revoke all on table private.payment_sheet_sync_jobs from public, anon, authenticated, service_role;
revoke all on table private.payment_sheet_sync_events from public, anon, authenticated, service_role;

create or replace function private.enqueue_payment_sheet_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and row(
    old.user_id, old.plan_id, old.provider, old.payment_method, old.amount, old.currency,
    old.transaction_reference, old.sender_identifier, old.status, old.reviewed_by,
    old.reviewed_at, old.student_message_en, old.reference_number, old.payment_at,
    old.expected_amount_snapshot, old.plan_snapshot, old.submitted_at,
    old.cancellation_requested_at, old.cancelled_at
  ) is not distinct from row(
    new.user_id, new.plan_id, new.provider, new.payment_method, new.amount, new.currency,
    new.transaction_reference, new.sender_identifier, new.status, new.reviewed_by,
    new.reviewed_at, new.student_message_en, new.reference_number, new.payment_at,
    new.expected_amount_snapshot, new.plan_snapshot, new.submitted_at,
    new.cancellation_requested_at, new.cancelled_at
  ) then return new; end if;

  insert into private.payment_sheet_sync_jobs (
    payment_submission_id, revision, status, attempt_count, next_attempt_at,
    lease_token, lease_expires_at, last_error_code, updated_at
  ) values (new.id, 1, 'queued', 0, now(), null, null, null, now())
  on conflict (payment_submission_id) do update
  set revision = private.payment_sheet_sync_jobs.revision + 1,
      status = case when private.payment_sheet_sync_jobs.status = 'syncing' then 'syncing' else 'queued' end,
      attempt_count = case when private.payment_sheet_sync_jobs.status = 'syncing' then private.payment_sheet_sync_jobs.attempt_count else 0 end,
      next_attempt_at = now(),
      lease_token = case when private.payment_sheet_sync_jobs.status = 'syncing' then private.payment_sheet_sync_jobs.lease_token else null end,
      lease_expires_at = case when private.payment_sheet_sync_jobs.status = 'syncing' then private.payment_sheet_sync_jobs.lease_expires_at else null end,
      last_error_code = null,
      updated_at = now();
  return new;
end;
$$;
revoke all on function private.enqueue_payment_sheet_sync() from public, anon, authenticated, service_role;
create trigger payment_sheet_sync_enqueue
  after insert or update on public.payment_submissions
  for each row execute function private.enqueue_payment_sheet_sync();

-- Existing payment requests enter the outbox when this migration is applied.
insert into private.payment_sheet_sync_jobs (payment_submission_id, revision, status, attempt_count, next_attempt_at)
select id, 1, 'queued', 0, now() from public.payment_submissions
on conflict (payment_submission_id) do nothing;

create or replace function public.claim_payment_sheet_sync_batch(p_limit integer default 10)
returns table (
  payment_submission_id uuid, revision bigint, lease_token uuid,
  submitted_at_utc timestamptz, submitted_at_bangladesh text,
  student_id uuid, student_name text, student_email text,
  plan_code text, plan_name text, expected_amount numeric, submitted_amount numeric,
  currency text, payment_method text, sender_name text, sender_number_masked text,
  transaction_id text, reference_number text, payment_at timestamptz,
  payment_status text, reviewer text, reviewed_at timestamptz, rejection_reason text,
  entitlement_start timestamptz, entitlement_expiry timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select j.payment_submission_id
    from private.payment_sheet_sync_jobs j
    where (j.status = 'queued' and j.next_attempt_at <= now())
       or (j.status = 'syncing' and j.lease_expires_at < now())
    order by j.next_attempt_at, j.updated_at
    limit greatest(1, least(coalesce(p_limit, 10), 25))
    for update skip locked
  ), claimed as (
    update private.payment_sheet_sync_jobs j
    set status = 'syncing', claimed_revision = j.revision,
        attempt_count = j.attempt_count + 1, lease_token = gen_random_uuid(),
        lease_expires_at = now() + interval '2 minutes', last_attempt_at = now(), updated_at = now()
    from due
    where j.payment_submission_id = due.payment_submission_id
    returning j.payment_submission_id, j.revision, j.lease_token
  )
  select c.payment_submission_id, c.revision, c.lease_token, ps.submitted_at,
    to_char(ps.submitted_at at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI:SS') || ' Asia/Dhaka',
    ps.user_id,
    coalesce(nullif(trim(pr.display_name), ''), nullif(au.raw_user_meta_data ->> 'full_name', ''), au.raw_user_meta_data ->> 'name'),
    au.email::text, pl.code, pl.name,
    coalesce(ps.expected_amount_snapshot, (ps.plan_snapshot ->> 'price')::numeric, pl.price),
    ps.amount, ps.currency, ps.payment_method, ps.sender_name,
    case when ps.sender_identifier is null then null
      else '••••' || right(regexp_replace(ps.sender_identifier, '\D', '', 'g'), 4) end,
    ps.transaction_reference, ps.reference_number, ps.payment_at,
    case when ps.cancelled_at is not null then 'cancelled'
      when ps.cancellation_requested_at is not null then 'cancellation_requested'
      when ps.status = 'needs_review'::public.payment_status then 'under_review'
      when ps.status = 'verified'::public.payment_status then 'approved'
      else ps.status::text end,
    reviewer.email::text, ps.reviewed_at,
    case when ps.status = 'rejected'::public.payment_status then ps.rejection_category else null end,
    ue.starts_at, ue.ends_at
  from claimed c
  join public.payment_submissions ps on ps.id = c.payment_submission_id
  join public.plans pl on pl.id = ps.plan_id
  join auth.users au on au.id = ps.user_id
  left join public.profiles pr on pr.user_id = ps.user_id
  left join auth.users reviewer on reviewer.id = ps.reviewed_by
  left join public.user_entitlements ue on ue.source_payment_submission_id = ps.id;
end;
$$;
revoke all on function public.claim_payment_sheet_sync_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_payment_sheet_sync_batch(integer) to service_role;

create or replace function public.get_payment_sheet_reconciliation_ids(p_limit integer default 20000)
returns table (payment_submission_id uuid)
language sql
security definer
set search_path = ''
as $$
  select ps.id
  from public.payment_submissions ps
  where ps.status = 'verified'::public.payment_status and ps.cancelled_at is null
  order by ps.submitted_at, ps.id
  limit greatest(1, least(coalesce(p_limit, 20000), 20001));
$$;
revoke all on function public.get_payment_sheet_reconciliation_ids(integer) from public, anon, authenticated;
grant execute on function public.get_payment_sheet_reconciliation_ids(integer) to service_role;

create or replace function public.complete_payment_sheet_sync(
  p_payment_submission_id uuid, p_revision bigint, p_lease_token uuid,
  p_success boolean, p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  job private.payment_sheet_sync_jobs%rowtype;
  safe_error text := case when p_error_code in (
    'configuration_missing', 'google_auth_failed', 'google_access_denied',
    'google_rate_limited', 'google_unavailable', 'google_request_failed',
    'sheet_header_mismatch', 'invalid_sheet_response', 'sync_failed'
  ) then p_error_code else 'sync_failed' end;
begin
  select * into job from private.payment_sheet_sync_jobs
  where payment_submission_id = p_payment_submission_id and lease_token = p_lease_token
  for update;
  if not found then return false; end if;

  if job.revision <> p_revision then
    update private.payment_sheet_sync_jobs
    set status = 'queued', claimed_revision = null, lease_token = null,
        lease_expires_at = null, next_attempt_at = now(), updated_at = now()
    where payment_submission_id = job.payment_submission_id;
    insert into private.payment_sheet_sync_events (payment_submission_id, revision, attempt, status)
    values (job.payment_submission_id, p_revision, job.attempt_count, 'superseded');
    return true;
  end if;

  if p_success then
    update private.payment_sheet_sync_jobs
    set status = 'synced', claimed_revision = null, lease_token = null,
        lease_expires_at = null, last_synced_at = now(), last_error_code = null, updated_at = now()
    where payment_submission_id = job.payment_submission_id;
    insert into private.payment_sheet_sync_events (payment_submission_id, revision, attempt, status)
    values (job.payment_submission_id, p_revision, job.attempt_count, 'synced');
  else
    update private.payment_sheet_sync_jobs
    set status = 'failed', claimed_revision = null, lease_token = null,
        lease_expires_at = null,
        next_attempt_at = now() + (least(86400, 300 * power(2, least(job.attempt_count - 1, 8)))::integer * interval '1 second'),
        last_error_code = safe_error, updated_at = now()
    where payment_submission_id = job.payment_submission_id;
    insert into private.payment_sheet_sync_events (payment_submission_id, revision, attempt, status, error_code)
    values (job.payment_submission_id, p_revision, job.attempt_count, 'failed', safe_error);
  end if;
  return true;
end;
$$;
revoke all on function public.complete_payment_sheet_sync(uuid, bigint, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_payment_sheet_sync(uuid, bigint, uuid, boolean, text) to service_role;

create or replace function public.record_admin_payment_sheet_sync_run()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'payment_sheet_sync.run_requested', 'payment_sheet_sync', jsonb_build_object('source', 'admin_console'));
  return true;
end;
$$;
revoke all on function public.record_admin_payment_sheet_sync_run() from public, anon;
grant execute on function public.record_admin_payment_sheet_sync_run() to authenticated;

create or replace function public.record_admin_payment_sheet_reconciliation()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'payment_sheet_sync.reconciliation_requested', 'payment_sheet_sync', jsonb_build_object('source', 'admin_console'));
  return true;
end;
$$;
revoke all on function public.record_admin_payment_sheet_reconciliation() from public, anon;
grant execute on function public.record_admin_payment_sheet_reconciliation() to authenticated;

create or replace function public.get_admin_payment_sheet_sync_status()
returns table (
  payment_submission_id uuid, submitted_at timestamptz, student_name text,
  student_email text, plan_code text, payment_status text, sync_status text,
  attempt_count integer, last_attempt_at timestamptz, last_synced_at timestamptz,
  last_error_code text, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  return query
  select j.payment_submission_id, ps.submitted_at,
    coalesce(nullif(trim(pr.display_name), ''), nullif(au.raw_user_meta_data ->> 'full_name', ''), au.raw_user_meta_data ->> 'name'),
    au.email::text, pl.code, ps.status::text, j.status, j.attempt_count,
    j.last_attempt_at, j.last_synced_at, j.last_error_code, j.updated_at
  from private.payment_sheet_sync_jobs j
  join public.payment_submissions ps on ps.id = j.payment_submission_id
  join public.plans pl on pl.id = ps.plan_id
  join auth.users au on au.id = ps.user_id
  left join public.profiles pr on pr.user_id = ps.user_id
  order by j.updated_at desc limit 100;
end;
$$;
revoke all on function public.get_admin_payment_sheet_sync_status() from public, anon;
grant execute on function public.get_admin_payment_sheet_sync_status() to authenticated;

create or replace function public.admin_retry_failed_payment_sheet_sync()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  retried integer := 0;
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  update private.payment_sheet_sync_jobs
  set status = 'queued', attempt_count = 0, next_attempt_at = now(), last_error_code = null,
      lease_token = null, lease_expires_at = null, claimed_revision = null, updated_at = now()
  where status = 'failed';
  get diagnostics retried = row_count;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'payment_sheet_sync.retry_failed', 'payment_sheet_sync', jsonb_build_object('retried', retried));
  return retried;
end;
$$;
revoke all on function public.admin_retry_failed_payment_sheet_sync() from public, anon;
grant execute on function public.admin_retry_failed_payment_sheet_sync() to authenticated;

-- Keep CSV/XLSX exports aligned with the independent sync outbox.
create or replace function public.get_admin_payment_export_rows(
  p_from_date date, p_to_date date, p_format text, p_unmask boolean default false
)
returns table (
  payment_request_id uuid, submitted_at_utc timestamptz, submitted_at_bangladesh text,
  student_id uuid, student_name text, student_email text, plan_code text, plan_name text,
  expected_amount numeric, submitted_amount numeric, currency text, payment_method text,
  sender_name text, sender_number text, transaction_id text, reference_number text,
  payment_at timestamptz, status public.payment_status, reviewer text, reviewed_at timestamptz,
  rejection_reason text, entitlement_start timestamptz, entitlement_expiry timestamptz,
  spreadsheet_sync_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  can_unmask boolean := false;
  exported_rows integer := 0;
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role, 'payment_reviewer'::public.app_role])) then
    raise exception 'Payment report access is required';
  end if;
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date or p_to_date - p_from_date > 365 then
    raise exception 'Choose a valid date range of 366 days or less';
  end if;
  if p_format is null or p_format not in ('csv', 'xlsx') then raise exception 'Choose CSV or XLSX format'; end if;
  can_unmask := coalesce(p_unmask, false) and (select private.has_any_role(array['admin'::public.app_role]));
  return query
  select ps.id, ps.submitted_at,
    to_char(ps.submitted_at at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI:SS') || ' Asia/Dhaka',
    ps.user_id,
    coalesce(nullif(trim(pr.display_name), ''), nullif(au.raw_user_meta_data ->> 'full_name', ''), au.raw_user_meta_data ->> 'name'),
    au.email::text, pl.code, pl.name, coalesce(ps.expected_amount_snapshot, pl.price), ps.amount,
    ps.currency, ps.payment_method, ps.sender_name,
    case when can_unmask then ps.sender_identifier when ps.sender_identifier is null then null
      else '••••' || right(regexp_replace(ps.sender_identifier, '\D', '', 'g'), 4) end,
    ps.transaction_reference, ps.reference_number, ps.payment_at, ps.status, reviewer.email::text,
    ps.reviewed_at,
    case when ps.status = 'rejected'::public.payment_status then ps.rejection_category else null end,
    ue.starts_at, ue.ends_at, coalesce(sync.status, 'not_configured')
  from public.payment_submissions ps
  join public.plans pl on pl.id = ps.plan_id
  join auth.users au on au.id = ps.user_id
  left join public.profiles pr on pr.user_id = ps.user_id
  left join auth.users reviewer on reviewer.id = ps.reviewed_by
  left join public.user_entitlements ue on ue.source_payment_submission_id = ps.id
  left join private.payment_sheet_sync_jobs sync on sync.payment_submission_id = ps.id
  where ps.submitted_at >= (p_from_date::timestamp at time zone 'UTC')
    and ps.submitted_at < ((p_to_date + 1)::timestamp at time zone 'UTC')
  order by ps.submitted_at, ps.id limit 20001;
  get diagnostics exported_rows = row_count;
  if exported_rows > 20000 then raise exception 'The report exceeds 20000 rows; narrow the date range'; end if;
  insert into public.admin_exports (actor_user_id, export_type, format, date_from, date_to, row_count, unmasked_sensitive_fields)
  values (actor_id, 'payment_submissions', p_format, p_from_date, p_to_date, exported_rows, can_unmask);
  insert into public.admin_audit_events (actor_user_id, action, entity_type, after_state)
  values (actor_id, 'payment_report.exported', 'payment_export', jsonb_build_object(
    'format', p_format, 'date_from', p_from_date, 'date_to', p_to_date,
    'row_count', exported_rows, 'unmasked_sensitive_fields', can_unmask
  ));
end;
$$;
revoke all on function public.get_admin_payment_export_rows(date, date, text, boolean) from public, anon;
grant execute on function public.get_admin_payment_export_rows(date, date, text, boolean) to authenticated;

commit;

