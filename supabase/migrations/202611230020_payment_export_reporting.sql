-- Add owner-scoped CSV/XLSX payment reports with auditable, server-side access.
-- Apply after migrations 001 through 019.

begin;

alter table public.payment_submissions
  add column expected_amount_snapshot numeric(12, 2) check (expected_amount_snapshot is null or expected_amount_snapshot > 0),
  add column sender_name text check (sender_name is null or char_length(trim(sender_name)) between 1 and 120),
  add column reference_number text check (reference_number is null or char_length(trim(reference_number)) between 1 and 120),
  add column payment_at timestamptz;

update public.payment_submissions ps
set expected_amount_snapshot = pl.price
from public.plans pl
where pl.id = ps.plan_id and ps.expected_amount_snapshot is null;

create table public.admin_exports (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  export_type text not null check (export_type = 'payment_submissions'),
  format text not null check (format in ('csv', 'xlsx')),
  date_from date not null,
  date_to date not null,
  row_count integer not null check (row_count between 0 and 20000),
  unmasked_sensitive_fields boolean not null default false,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create index admin_exports_created_at_idx on public.admin_exports (created_at desc);
alter table public.admin_exports enable row level security;
revoke all on public.admin_exports from anon, authenticated;
grant select on public.admin_exports to authenticated;

create policy "admin exports: administrators can read export history"
  on public.admin_exports for select to authenticated
  using ((select private.has_any_role(array['admin'::public.app_role])));

create trigger admin_exports_append_only
  before update or delete on public.admin_exports
  for each row execute function public.prevent_audit_event_mutation();

create or replace function public.get_admin_payment_export_rows(
  p_from_date date,
  p_to_date date,
  p_format text,
  p_unmask boolean default false
)
returns table (
  payment_request_id uuid,
  submitted_at_utc timestamptz,
  submitted_at_bangladesh text,
  student_id uuid,
  student_name text,
  student_email text,
  plan_code text,
  plan_name text,
  expected_amount numeric,
  submitted_amount numeric,
  currency text,
  payment_method text,
  sender_name text,
  sender_number text,
  transaction_id text,
  reference_number text,
  payment_at timestamptz,
  status public.payment_status,
  reviewer text,
  reviewed_at timestamptz,
  rejection_reason text,
  entitlement_start timestamptz,
  entitlement_expiry timestamptz,
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
  if actor_id is null
    or not (select private.has_any_role(array['admin'::public.app_role, 'payment_reviewer'::public.app_role])) then
    raise exception 'Payment report access is required';
  end if;
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date
    or p_to_date - p_from_date > 365 then
    raise exception 'Choose a valid date range of 366 days or less';
  end if;
  if p_format is null or p_format not in ('csv', 'xlsx') then
    raise exception 'Choose CSV or XLSX format';
  end if;

  can_unmask := coalesce(p_unmask, false)
    and (select private.has_any_role(array['admin'::public.app_role]));

  return query
  select
    ps.id,
    ps.submitted_at,
    to_char(ps.submitted_at at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI:SS') || ' Asia/Dhaka',
    ps.user_id,
    coalesce(nullif(trim(pr.display_name), ''), nullif(au.raw_user_meta_data ->> 'full_name', ''), au.raw_user_meta_data ->> 'name'),
    au.email::text,
    pl.code,
    pl.name,
    coalesce(ps.expected_amount_snapshot, pl.price),
    ps.amount,
    ps.currency,
    ps.payment_method,
    ps.sender_name,
    case
      when can_unmask then ps.sender_identifier
      when ps.sender_identifier is null then null
      else '••••' || right(regexp_replace(ps.sender_identifier, '\D', '', 'g'), 4)
    end,
    ps.transaction_reference,
    ps.reference_number,
    ps.payment_at,
    ps.status,
    reviewer.email::text,
    ps.reviewed_at,
    case when ps.status = 'rejected'::public.payment_status then ps.review_note else null end,
    ue.starts_at,
    ue.ends_at,
    'not_configured'::text
  from public.payment_submissions ps
  join public.plans pl on pl.id = ps.plan_id
  join auth.users au on au.id = ps.user_id
  left join public.profiles pr on pr.user_id = ps.user_id
  left join auth.users reviewer on reviewer.id = ps.reviewed_by
  left join public.user_entitlements ue on ue.source_payment_submission_id = ps.id
  where ps.submitted_at >= (p_from_date::timestamp at time zone 'UTC')
    and ps.submitted_at < ((p_to_date + 1)::timestamp at time zone 'UTC')
  order by ps.submitted_at, ps.id
  limit 20001;

  get diagnostics exported_rows = row_count;
  if exported_rows > 20000 then
    raise exception 'The report exceeds 20000 rows; narrow the date range';
  end if;

  insert into public.admin_exports (
    actor_user_id, export_type, format, date_from, date_to, row_count, unmasked_sensitive_fields
  ) values (
    actor_id, 'payment_submissions', p_format, p_from_date, p_to_date, exported_rows, can_unmask
  );

  insert into public.admin_audit_events (
    actor_user_id, action, entity_type, after_state
  ) values (
    actor_id,
    'payment_report.exported',
    'payment_export',
    jsonb_build_object(
      'format', p_format,
      'date_from', p_from_date,
      'date_to', p_to_date,
      'row_count', exported_rows,
      'unmasked_sensitive_fields', can_unmask
    )
  );
end;
$$;

revoke all on function public.get_admin_payment_export_rows(date, date, text, boolean) from public, anon;
grant execute on function public.get_admin_payment_export_rows(date, date, text, boolean) to authenticated;

commit;
