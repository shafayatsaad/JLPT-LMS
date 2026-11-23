-- Manual bKash Send Money payment workflow. This migration prepares the workflow but
-- seeds checkout disabled and every suggested plan inactive at zero price.
-- Apply after migrations 001 through 021 and after checking the Supabase ledger.

begin;

alter table public.plans
  add column name_bn text not null default 'Premium plan';

update public.plans
set name_bn = case code
  when 'premium_30d' then 'প্রিমিয়াম মাসিক'
  when 'premium_90d' then 'প্রিমিয়াম ত্রৈমাসিক'
  when 'premium_365d' then 'প্রিমিয়াম বার্ষিক'
  else name
end
where name_bn = 'Premium plan';

insert into public.plans (code, name, name_bn, price, currency, duration_days, features, is_active)
values
  ('premium_30d', 'Premium Monthly', 'প্রিমিয়াম মাসিক', 0, 'BDT', 30,
    '{"proposed":true,"full_mocks":true,"full_practice":true,"detailed_results":true}'::jsonb, false),
  ('premium_90d', 'Premium Quarterly', 'প্রিমিয়াম ত্রৈমাসিক', 0, 'BDT', 90,
    '{"proposed":true,"full_mocks":true,"full_practice":true,"detailed_results":true}'::jsonb, false),
  ('premium_365d', 'Premium Annual', 'প্রিমিয়াম বার্ষিক', 0, 'BDT', 365,
    '{"proposed":true,"full_mocks":true,"full_practice":true,"detailed_results":true}'::jsonb, false)
on conflict (code) do nothing;

create table public.manual_payment_settings (
  id integer primary key default 1 check (id = 1),
  is_enabled boolean not null default false,
  provider text not null default 'bkash' check (provider = 'bkash'),
  payment_method text not null default 'send_money' check (payment_method = 'send_money'),
  recipient_display_name text,
  recipient_number text,
  recipient_account_type text,
  instructions_en text,
  instructions_bn text,
  reference_required boolean not null default false,
  support_contact text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (recipient_display_name is null or char_length(trim(recipient_display_name)) between 2 and 120),
  check (recipient_number is null or char_length(trim(recipient_number)) between 6 and 32),
  check (recipient_account_type is null or char_length(trim(recipient_account_type)) between 2 and 80),
  check (instructions_en is null or char_length(trim(instructions_en)) between 20 and 2000),
  check (instructions_bn is null or char_length(trim(instructions_bn)) between 20 and 2000),
  check (support_contact is null or char_length(trim(support_contact)) <= 200),
  check (
    not is_enabled or (
      nullif(trim(recipient_display_name), '') is not null
      and nullif(trim(recipient_number), '') is not null
      and nullif(trim(recipient_account_type), '') is not null
      and nullif(trim(instructions_en), '') is not null
      and nullif(trim(instructions_bn), '') is not null
    )
  )
);

insert into public.manual_payment_settings (id, is_enabled)
values (1, false)
on conflict (id) do nothing;

alter table public.manual_payment_settings enable row level security;
revoke all on public.manual_payment_settings from anon, authenticated;

alter table public.payment_submissions
  add column idempotency_key uuid,
  add column plan_snapshot jsonb,
  add column request_note text,
  add column terms_confirmed_at timestamptz,
  add column cancellation_requested_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancellation_resolution_note text,
  add column rejection_category text,
  add column student_message_en text,
  add column student_message_bn text,
  add constraint payment_request_note_length check (request_note is null or char_length(trim(request_note)) <= 500),
  add constraint payment_rejection_category_valid check (rejection_category is null or rejection_category in (
    'amount_mismatch', 'transaction_not_found', 'duplicate_transaction', 'recipient_mismatch', 'invalid_details', 'other'
  )),
  add constraint payment_student_message_length check (
    (student_message_en is null or char_length(trim(student_message_en)) between 5 and 500)
    and (student_message_bn is null or char_length(trim(student_message_bn)) between 5 and 500)
  ),
  add constraint payment_plan_snapshot_object check (plan_snapshot is null or jsonb_typeof(plan_snapshot) = 'object');

update public.payment_submissions ps
set plan_snapshot = jsonb_build_object(
  'code', pl.code,
  'name', pl.name,
  'name_bn', pl.name_bn,
  'duration_days', pl.duration_days,
  'price', coalesce(ps.expected_amount_snapshot, ps.amount),
  'currency', ps.currency,
  'features', pl.features
)
from public.plans pl
where pl.id = ps.plan_id and ps.plan_snapshot is null;

alter table public.payment_submissions
  alter column plan_snapshot set not null,
  add constraint payment_plan_snapshot_required_fields check (
    plan_snapshot ? 'code'
    and plan_snapshot ? 'name'
    and plan_snapshot ? 'duration_days'
    and plan_snapshot ? 'price'
    and plan_snapshot ? 'currency'
    and plan_snapshot ? 'features'
  );

create unique index payment_submissions_idempotency_key_unique
  on public.payment_submissions (user_id, idempotency_key)
  where idempotency_key is not null;

create index payment_submissions_active_pending_user_idx
  on public.payment_submissions (user_id, submitted_at desc)
  where cancelled_at is null and status in ('pending', 'needs_review');

create or replace function public.get_payment_checkout_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  settings_row public.manual_payment_settings%rowtype;
  plans_json jsonb;
begin
  if actor_id is null then raise exception 'Sign in to view payment options'; end if;

  select * into settings_row
  from public.manual_payment_settings
  where id = 1;

  if not found or not settings_row.is_enabled then
    return jsonb_build_object('enabled', false, 'plans', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'name_bn', p.name_bn,
    'duration_days', p.duration_days,
    'price', p.price,
    'currency', p.currency,
    'features', p.features
  ) order by p.duration_days), '[]'::jsonb)
  into plans_json
  from public.plans p
  where p.is_active and p.price > 0 and p.currency = 'BDT';

  return jsonb_build_object(
    'enabled', jsonb_array_length(plans_json) > 0,
    'provider', settings_row.provider,
    'payment_method', settings_row.payment_method,
    'recipient_display_name', settings_row.recipient_display_name,
    'recipient_number', settings_row.recipient_number,
    'recipient_account_type', settings_row.recipient_account_type,
    'instructions_en', settings_row.instructions_en,
    'instructions_bn', settings_row.instructions_bn,
    'reference_required', settings_row.reference_required,
    'support_contact', settings_row.support_contact,
    'plans', plans_json
  );
end;
$$;

create or replace function public.get_admin_payment_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  settings_row public.manual_payment_settings%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;

  select * into settings_row from public.manual_payment_settings where id = 1;
  return jsonb_build_object(
    'is_enabled', coalesce(settings_row.is_enabled, false),
    'provider', coalesce(settings_row.provider, 'bkash'),
    'payment_method', coalesce(settings_row.payment_method, 'send_money'),
    'recipient_display_name', settings_row.recipient_display_name,
    'recipient_number', settings_row.recipient_number,
    'recipient_account_type', settings_row.recipient_account_type,
    'instructions_en', settings_row.instructions_en,
    'instructions_bn', settings_row.instructions_bn,
    'reference_required', coalesce(settings_row.reference_required, false),
    'support_contact', settings_row.support_contact,
    'updated_at', settings_row.updated_at
  );
end;
$$;

create or replace function public.save_admin_payment_settings(
  p_is_enabled boolean,
  p_recipient_display_name text,
  p_recipient_number text,
  p_recipient_account_type text,
  p_instructions_en text,
  p_instructions_bn text,
  p_reference_required boolean,
  p_support_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  before_row public.manual_payment_settings%rowtype;
  after_row public.manual_payment_settings%rowtype;
  name_value text := nullif(trim(coalesce(p_recipient_display_name, '')), '');
  number_value text := nullif(trim(coalesce(p_recipient_number, '')), '');
  account_type_value text := nullif(trim(coalesce(p_recipient_account_type, '')), '');
  instructions_en_value text := nullif(trim(coalesce(p_instructions_en, '')), '');
  instructions_bn_value text := nullif(trim(coalesce(p_instructions_bn, '')), '');
  support_contact_value text := nullif(trim(coalesce(p_support_contact, '')), '');
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  if p_is_enabled and (
    name_value is null or number_value is null or account_type_value is null
    or instructions_en_value is null or instructions_bn_value is null
  ) then
    raise exception 'Complete and verify the recipient and both instruction languages before enabling checkout';
  end if;
  if name_value is not null and char_length(name_value) not between 2 and 120 then raise exception 'Recipient name must be 2 to 120 characters'; end if;
  if number_value is not null and char_length(number_value) not between 6 and 32 then raise exception 'Recipient number or identifier must be 6 to 32 characters'; end if;
  if account_type_value is not null and char_length(account_type_value) not between 2 and 80 then raise exception 'Account type must be 2 to 80 characters'; end if;
  if instructions_en_value is not null and char_length(instructions_en_value) not between 20 and 2000 then raise exception 'English instructions must be 20 to 2000 characters'; end if;
  if instructions_bn_value is not null and char_length(instructions_bn_value) not between 20 and 2000 then raise exception 'Bangla instructions must be 20 to 2000 characters'; end if;
  if support_contact_value is not null and char_length(support_contact_value) > 200 then raise exception 'Support contact must be at most 200 characters'; end if;

  select * into before_row from public.manual_payment_settings where id = 1 for update;
  insert into public.manual_payment_settings (
    id, is_enabled, recipient_display_name, recipient_number, recipient_account_type,
    instructions_en, instructions_bn, reference_required, support_contact, updated_by, updated_at
  ) values (
    1, coalesce(p_is_enabled, false), name_value, number_value, account_type_value,
    instructions_en_value, instructions_bn_value, coalesce(p_reference_required, false), support_contact_value, actor_id, now()
  )
  on conflict (id) do update set
    is_enabled = excluded.is_enabled,
    recipient_display_name = excluded.recipient_display_name,
    recipient_number = excluded.recipient_number,
    recipient_account_type = excluded.recipient_account_type,
    instructions_en = excluded.instructions_en,
    instructions_bn = excluded.instructions_bn,
    reference_required = excluded.reference_required,
    support_contact = excluded.support_contact,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into after_row;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, before_state, after_state)
  values (
    actor_id,
    'payment_settings.updated',
    'manual_payment_settings',
    jsonb_build_object('is_enabled', before_row.is_enabled, 'reference_required', before_row.reference_required,
      'recipient_configured', before_row.recipient_number is not null, 'instructions_configured', before_row.instructions_en is not null),
    jsonb_build_object('is_enabled', after_row.is_enabled, 'reference_required', after_row.reference_required,
      'recipient_configured', after_row.recipient_number is not null, 'instructions_configured', after_row.instructions_en is not null)
  );

  return jsonb_build_object('is_enabled', after_row.is_enabled, 'updated_at', after_row.updated_at);
end;
$$;

create or replace function public.get_admin_payment_plans()
returns table (
  id uuid,
  code text,
  name text,
  name_bn text,
  price numeric,
  currency text,
  duration_days integer,
  features jsonb,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  return query
  select p.id, p.code, p.name, p.name_bn, p.price, p.currency, p.duration_days, p.features, p.is_active, p.updated_at
  from public.plans p
  order by p.duration_days, p.code;
end;
$$;

create or replace function public.save_admin_payment_plan(
  p_code text,
  p_name text,
  p_name_bn text,
  p_price numeric,
  p_duration_days integer,
  p_features jsonb,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  code_value text := lower(trim(coalesce(p_code, '')));
  name_value text := trim(coalesce(p_name, ''));
  name_bn_value text := trim(coalesce(p_name_bn, ''));
  before_row public.plans%rowtype;
  after_row public.plans%rowtype;
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role])) then
    raise exception 'Administrator access is required';
  end if;
  if code_value !~ '^premium_[a-z0-9_]{2,40}$' then raise exception 'Plan code must use the premium_ prefix and lowercase letters, numbers or underscores'; end if;
  if char_length(name_value) not between 3 and 80 or char_length(name_bn_value) not between 3 and 80 then
    raise exception 'Plan names must be 3 to 80 characters in both languages';
  end if;
  if p_price is null or p_price < 0 or p_price > 10000000 then raise exception 'Enter a valid BDT price'; end if;
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 3650 then raise exception 'Plan duration must be between 1 and 3650 days'; end if;
  if coalesce(p_is_active, false) and p_price <= 0 then raise exception 'An active plan must have a positive price'; end if;
  if p_features is null or jsonb_typeof(p_features) <> 'object' then raise exception 'Plan features must be a JSON object'; end if;

  select * into before_row from public.plans where code = code_value for update;
  insert into public.plans (code, name, name_bn, price, currency, duration_days, features, is_active, updated_at)
  values (code_value, name_value, name_bn_value, p_price, 'BDT', p_duration_days, p_features, coalesce(p_is_active, false), now())
  on conflict (code) do update set
    name = excluded.name,
    name_bn = excluded.name_bn,
    price = excluded.price,
    currency = excluded.currency,
    duration_days = excluded.duration_days,
    features = excluded.features,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at
  returning * into after_row;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (
    actor_id,
    'payment_plan.updated',
    'plan',
    after_row.id,
    case when before_row.id is null then null else jsonb_build_object(
      'code', before_row.code, 'name', before_row.name, 'price', before_row.price,
      'currency', before_row.currency, 'duration_days', before_row.duration_days,
      'features', before_row.features, 'is_active', before_row.is_active
    ) end,
    jsonb_build_object(
      'code', after_row.code, 'name', after_row.name, 'price', after_row.price,
      'currency', after_row.currency, 'duration_days', after_row.duration_days,
      'features', after_row.features, 'is_active', after_row.is_active
    )
  );
  return after_row.id;
end;
$$;

create or replace function public.create_payment_request(
  p_plan_id uuid,
  p_sender_name text,
  p_sender_number text,
  p_transaction_id text,
  p_reference_number text,
  p_payment_at timestamptz,
  p_request_note text,
  p_terms_confirmed boolean,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  settings_row public.manual_payment_settings%rowtype;
  plan_row public.plans%rowtype;
  existing_id uuid;
  payment_id uuid;
  name_value text := trim(coalesce(p_sender_name, ''));
  sender_value text := trim(coalesce(p_sender_number, ''));
  transaction_value text := upper(regexp_replace(trim(coalesce(p_transaction_id, '')), '[[:space:]]+', '', 'g'));
  reference_value text := nullif(trim(coalesce(p_reference_number, '')), '');
  note_value text := nullif(trim(coalesce(p_request_note, '')), '');
  ui_language_value text;
begin
  if actor_id is null then raise exception 'Sign in before submitting a payment request'; end if;
  if p_idempotency_key is null then raise exception 'A request key is required'; end if;

  perform pg_advisory_xact_lock(hashtext(actor_id::text));
  select ps.id into existing_id
  from public.payment_submissions ps
  where ps.user_id = actor_id and ps.idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  select * into settings_row from public.manual_payment_settings where id = 1;
  if not found or not settings_row.is_enabled then raise exception 'Payment checkout is not available'; end if;
  if p_terms_confirmed is distinct from true then raise exception 'Confirm that the payment details are accurate'; end if;
  if char_length(name_value) not between 2 and 120 then raise exception 'Sender name must be between 2 and 120 characters'; end if;
  if char_length(sender_value) not between 6 and 32 or sender_value !~ '^[+0-9 -]+$' then raise exception 'Enter a valid sender bKash number'; end if;
  if char_length(transaction_value) not between 4 and 80 or transaction_value !~ '^[A-Z0-9_-]+$' then raise exception 'Enter a valid transaction ID'; end if;
  if settings_row.reference_required and (reference_value is null or char_length(reference_value) not between 1 and 120) then
    raise exception 'Enter the required payment reference';
  end if;
  if reference_value is not null and char_length(reference_value) > 120 then raise exception 'Payment reference must be at most 120 characters'; end if;
  if note_value is not null and char_length(note_value) > 500 then raise exception 'Note must be at most 500 characters'; end if;
  if p_payment_at is null then raise exception 'Payment date is required'; end if;
  if p_payment_at > now() + interval '10 minutes' then raise exception 'Payment date and time cannot be in the future'; end if;

  select * into plan_row from public.plans where id = p_plan_id for share;
  if not found or not plan_row.is_active or plan_row.price <= 0 or plan_row.currency <> 'BDT' then
    raise exception 'This plan is not available for purchase';
  end if;

  if exists (
    select 1 from public.payment_submissions ps
    where ps.user_id = actor_id and ps.cancelled_at is null and ps.status in ('pending', 'needs_review')
  ) then raise exception 'Resolve or cancel the existing payment request before submitting another'; end if;
  if exists (
    select 1 from public.payment_submissions ps
    where ps.provider = settings_row.provider and upper(ps.transaction_reference) = transaction_value
  ) then raise exception 'This transaction ID has already been submitted'; end if;

  insert into public.payment_submissions (
    user_id, plan_id, provider, payment_method, amount, currency, expected_amount_snapshot,
    sender_name, sender_identifier, transaction_reference, reference_number, payment_at,
    plan_snapshot, request_note, terms_confirmed_at, idempotency_key, status
  ) values (
    actor_id, plan_row.id, settings_row.provider, settings_row.payment_method, plan_row.price, plan_row.currency, plan_row.price,
    name_value, sender_value, transaction_value, reference_value, p_payment_at,
    jsonb_build_object('code', plan_row.code, 'name', plan_row.name, 'name_bn', plan_row.name_bn,
      'duration_days', plan_row.duration_days, 'price', plan_row.price, 'currency', plan_row.currency, 'features', plan_row.features),
    note_value, now(), p_idempotency_key, 'pending'
  ) returning id into payment_id;

  insert into public.payment_audit_events (payment_submission_id, actor_user_id, action, after_state)
  values (payment_id, actor_id, 'payment_request.submitted', jsonb_build_object('status', 'pending', 'plan_code', plan_row.code, 'amount', plan_row.price, 'currency', plan_row.currency));

  select coalesce(p.ui_language, 'en') into ui_language_value from public.profiles p where p.user_id = actor_id;
  insert into public.notifications (user_id, notification_type, title, body, href)
  values (
    actor_id,
    'payment_submitted',
    case when ui_language_value = 'bn' then 'পেমেন্টের অনুরোধ পাওয়া গেছে' else 'Payment request received' end,
    case when ui_language_value = 'bn' then 'আপনার পেমেন্টের অনুরোধ যাচাইয়ের অপেক্ষায় আছে।' else 'Your payment request is waiting for verification.' end,
    '/payments'
  );

  return payment_id;
end;
$$;

create or replace function public.request_payment_cancellation(p_payment_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  payment_row public.payment_submissions%rowtype;
begin
  if actor_id is null then raise exception 'Sign in to manage this payment request'; end if;
  select * into payment_row from public.payment_submissions
  where id = p_payment_submission_id and user_id = actor_id
  for update;
  if not found then raise exception 'Payment request is unavailable'; end if;
  if payment_row.cancelled_at is not null then return payment_row.id; end if;
  if payment_row.status not in ('pending', 'needs_review') then raise exception 'This payment request can no longer be cancelled'; end if;
  if payment_row.cancellation_requested_at is not null then return payment_row.id; end if;

  update public.payment_submissions
  set cancellation_requested_at = now(), updated_at = now()
  where id = payment_row.id;

  insert into public.payment_audit_events (payment_submission_id, actor_user_id, action, before_state, after_state)
  values (
    payment_row.id, actor_id, 'payment_request.cancellation_requested',
    jsonb_build_object('status', payment_row.status::text, 'cancellation_requested', false),
    jsonb_build_object('status', payment_row.status::text, 'cancellation_requested', true)
  );
  return payment_row.id;
end;
$$;

create or replace function public.get_admin_payment_review_queue(
  p_status text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_search text default null
)
returns table (
  id uuid,
  user_id uuid,
  learner_name text,
  learner_email text,
  plan_code text,
  plan_name text,
  plan_name_bn text,
  plan_duration_days integer,
  expected_amount numeric,
  amount numeric,
  currency text,
  status text,
  sender_number_masked text,
  transaction_reference text,
  submitted_at timestamptz,
  age_hours numeric,
  cancellation_requested_at timestamptz,
  cancelled_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  search_value text := nullif(trim(coalesce(p_search, '')), '');
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role, 'payment_reviewer'::public.app_role])) then
    raise exception 'Payment review access is required';
  end if;
  if p_from_date is not null and p_to_date is not null and p_to_date < p_from_date then raise exception 'Choose a valid date range'; end if;
  if p_to_date is not null and p_from_date is null then raise exception 'Provide both dates for a date filter'; end if;
  if p_from_date is not null and p_to_date is null then raise exception 'Provide both dates for a date filter'; end if;
  if p_from_date is not null and p_to_date - p_from_date > 365 then raise exception 'Date filter cannot exceed 366 days'; end if;
  if p_status is not null and p_status not in ('pending', 'needs_review', 'verified', 'rejected', 'cancelled') then raise exception 'Choose a valid payment status'; end if;

  return query
  select
    ps.id,
    ps.user_id,
    coalesce(nullif(trim(pr.display_name), ''), nullif(au.raw_user_meta_data ->> 'full_name', ''), au.raw_user_meta_data ->> 'name'),
    au.email::text,
    coalesce(ps.plan_snapshot ->> 'code', pl.code),
    coalesce(ps.plan_snapshot ->> 'name', pl.name),
    coalesce(ps.plan_snapshot ->> 'name_bn', pl.name_bn),
    coalesce((ps.plan_snapshot ->> 'duration_days')::integer, pl.duration_days),
    coalesce(ps.expected_amount_snapshot, (ps.plan_snapshot ->> 'price')::numeric, pl.price),
    ps.amount,
    ps.currency,
    case when ps.cancelled_at is not null then 'cancelled' else ps.status::text end,
    case when ps.sender_identifier is null then null else '••••' || right(regexp_replace(ps.sender_identifier, '\D', '', 'g'), 4) end,
    ps.transaction_reference,
    ps.submitted_at,
    round(extract(epoch from (now() - ps.submitted_at)) / 3600.0, 1),
    ps.cancellation_requested_at,
    ps.cancelled_at,
    ps.reviewed_at
  from public.payment_submissions ps
  join public.plans pl on pl.id = ps.plan_id
  join auth.users au on au.id = ps.user_id
  left join public.profiles pr on pr.user_id = ps.user_id
  where (p_status is null or case when ps.cancelled_at is not null then 'cancelled' else ps.status::text end = p_status)
    and (p_from_date is null or (ps.submitted_at >= p_from_date::timestamp at time zone 'UTC' and ps.submitted_at < (p_to_date + 1)::timestamp at time zone 'UTC'))
    and (search_value is null or ps.id::text ilike '%' || search_value || '%'
      or ps.user_id::text ilike '%' || search_value || '%'
      or coalesce(au.email::text, '') ilike '%' || search_value || '%'
      or coalesce(ps.transaction_reference, '') ilike '%' || search_value || '%'
      or coalesce(pl.code, '') ilike '%' || search_value || '%')
  order by case when ps.cancelled_at is not null then 4 when ps.status = 'pending' then 1 when ps.status = 'needs_review' then 2 when ps.status = 'verified' then 3 else 5 end,
    ps.submitted_at asc
  limit 500;
end;
$$;

create or replace function public.get_admin_payment_detail(
  p_payment_submission_id uuid,
  p_reveal_sender boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  payment_row public.payment_submissions%rowtype;
  profile_row public.profiles%rowtype;
  auth_row record;
  plan_row public.plans%rowtype;
  entitlement_json jsonb;
  audit_json jsonb;
  prior_count integer;
  sender_value text;
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role, 'payment_reviewer'::public.app_role])) then
    raise exception 'Payment review access is required';
  end if;
  select * into payment_row from public.payment_submissions where id = p_payment_submission_id;
  if not found then raise exception 'Payment request is unavailable'; end if;
  if payment_row.user_id = actor_id then raise exception 'A reviewer cannot review their own payment request'; end if;

  select * into profile_row from public.profiles where user_id = payment_row.user_id;
  select au.email::text as email, au.banned_until, au.created_at
    into auth_row from auth.users au where au.id = payment_row.user_id;
  select * into plan_row from public.plans where id = payment_row.plan_id;
  select jsonb_build_object('status', ue.status, 'starts_at', ue.starts_at, 'ends_at', ue.ends_at, 'plan_id', ue.plan_id)
    into entitlement_json
  from public.user_entitlements ue
  where ue.user_id = payment_row.user_id and ue.status = 'active'
  order by ue.ends_at desc limit 1;
  select count(*)::integer into prior_count
  from public.payment_submissions previous
  where previous.user_id = payment_row.user_id and previous.id <> payment_row.id;
  select coalesce(jsonb_agg(jsonb_build_object('action', pae.action, 'actor_user_id', pae.actor_user_id, 'created_at', pae.created_at, 'after_state', pae.after_state) order by pae.created_at), '[]'::jsonb)
    into audit_json
  from public.payment_audit_events pae where pae.payment_submission_id = payment_row.id;

  sender_value := case
    when p_reveal_sender then payment_row.sender_identifier
    when payment_row.sender_identifier is null then null
    else '••••' || right(regexp_replace(payment_row.sender_identifier, '\D', '', 'g'), 4)
  end;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'payment_detail.viewed', 'payment_submission', payment_row.id,
    jsonb_build_object('sender_number_revealed', coalesce(p_reveal_sender, false)));

  return jsonb_build_object(
    'id', payment_row.id,
    'user_id', payment_row.user_id,
    'learner_name', coalesce(nullif(trim(profile_row.display_name), ''), auth_row.email),
    'learner_email', auth_row.email,
    'account_created_at', auth_row.created_at,
    'account_banned_until', auth_row.banned_until,
    'plan', coalesce(payment_row.plan_snapshot, jsonb_build_object('code', plan_row.code, 'name', plan_row.name, 'name_bn', plan_row.name_bn, 'duration_days', plan_row.duration_days, 'price', plan_row.price, 'currency', plan_row.currency, 'features', plan_row.features)),
    'expected_amount', coalesce(payment_row.expected_amount_snapshot, (payment_row.plan_snapshot ->> 'price')::numeric, plan_row.price),
    'submitted_amount', payment_row.amount,
    'currency', payment_row.currency,
    'provider', payment_row.provider,
    'payment_method', payment_row.payment_method,
    'sender_name', payment_row.sender_name,
    'sender_number', sender_value,
    'sender_number_revealed', coalesce(p_reveal_sender, false),
    'transaction_reference', payment_row.transaction_reference,
    'reference_number', payment_row.reference_number,
    'payment_at', payment_row.payment_at,
    'request_note', payment_row.request_note,
    'status', case when payment_row.cancelled_at is not null then 'cancelled' else payment_row.status::text end,
    'cancellation_requested_at', payment_row.cancellation_requested_at,
    'cancelled_at', payment_row.cancelled_at,
    'cancellation_resolution_note', payment_row.cancellation_resolution_note,
    'reviewed_at', payment_row.reviewed_at,
    'review_note', payment_row.review_note,
    'rejection_category', payment_row.rejection_category,
    'student_message_en', payment_row.student_message_en,
    'student_message_bn', payment_row.student_message_bn,
    'active_entitlement', entitlement_json,
    'previous_request_count', prior_count,
    'audit_history', audit_json
  );
end;
$$;

create or replace function public.review_payment_request(
  p_payment_submission_id uuid,
  p_action text,
  p_internal_note text,
  p_rejection_category text default null,
  p_student_message_en text default null,
  p_student_message_bn text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  payment_row public.payment_submissions%rowtype;
  new_status public.payment_status;
  action_value text := lower(trim(coalesce(p_action, '')));
  internal_note_value text := trim(coalesce(p_internal_note, ''));
  student_message_en_value text := trim(coalesce(p_student_message_en, ''));
  student_message_bn_value text := trim(coalesce(p_student_message_bn, ''));
  plan_duration integer;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  entitlement_id uuid;
  ui_language_value text;
  before_json jsonb;
  after_json jsonb;
begin
  if actor_id is null or not (select private.has_any_role(array['admin'::public.app_role, 'payment_reviewer'::public.app_role])) then
    raise exception 'Payment review access is required';
  end if;
  if action_value not in ('under_review', 'return_to_pending', 'approve', 'reject', 'cancel') then raise exception 'Choose a valid review action'; end if;
  if char_length(internal_note_value) not between 5 and 1000 then raise exception 'Add an internal review note between 5 and 1000 characters'; end if;

  select * into payment_row from public.payment_submissions where id = p_payment_submission_id for update;
  if not found then raise exception 'Payment request is unavailable'; end if;
  if payment_row.user_id = actor_id then raise exception 'A reviewer cannot review their own payment request'; end if;

  if payment_row.cancelled_at is not null then
    if action_value = 'cancel' then return jsonb_build_object('id', payment_row.id, 'status', 'cancelled', 'idempotent', true); end if;
    raise exception 'This payment request is already cancelled';
  end if;
  if payment_row.status = 'verified' then
    if action_value = 'approve' then return jsonb_build_object('id', payment_row.id, 'status', 'verified', 'idempotent', true); end if;
    raise exception 'Verified payment requests cannot be changed';
  end if;
  if payment_row.status = 'rejected' then
    if action_value = 'reject' then return jsonb_build_object('id', payment_row.id, 'status', 'rejected', 'idempotent', true); end if;
    raise exception 'Rejected payment requests cannot be changed';
  end if;

  if action_value = 'under_review' then
    if payment_row.status = 'needs_review' then return jsonb_build_object('id', payment_row.id, 'status', 'needs_review', 'idempotent', true); end if;
    if payment_row.status <> 'pending' then raise exception 'Only pending requests can enter review'; end if;
    new_status := 'needs_review';
  elsif action_value = 'return_to_pending' then
    if payment_row.status <> 'needs_review' or payment_row.cancellation_requested_at is not null then raise exception 'This request cannot return to pending'; end if;
    new_status := 'pending';
  elsif action_value = 'approve' then
    if payment_row.status not in ('pending', 'needs_review') then raise exception 'This request is not eligible for approval'; end if;
    if payment_row.transaction_reference is null then raise exception 'A transaction ID is required before approval'; end if;
    if payment_row.amount <> coalesce(payment_row.expected_amount_snapshot, (payment_row.plan_snapshot ->> 'price')::numeric) then raise exception 'Submitted amount does not match the saved plan price'; end if;
    if exists (
      select 1 from public.payment_submissions duplicate
      where duplicate.id <> payment_row.id and duplicate.provider = payment_row.provider
        and duplicate.transaction_reference = payment_row.transaction_reference
        and duplicate.status = 'verified'
    ) then raise exception 'This transaction ID was already verified on another request'; end if;
    plan_duration := (payment_row.plan_snapshot ->> 'duration_days')::integer;
    if plan_duration is null or plan_duration < 1 or plan_duration > 3650 then raise exception 'The saved plan snapshot is unavailable'; end if;

    select max(ue.ends_at) into starts_at_value
    from public.user_entitlements ue
    where ue.user_id = payment_row.user_id and ue.status = 'active' and ue.ends_at > now();
    starts_at_value := coalesce(starts_at_value, now());
    ends_at_value := starts_at_value + make_interval(days => plan_duration);
    insert into public.user_entitlements (user_id, plan_id, status, starts_at, ends_at, source_payment_submission_id)
    values (payment_row.user_id, payment_row.plan_id, 'active', starts_at_value, ends_at_value, payment_row.id)
    returning id into entitlement_id;
    new_status := 'verified';
  elsif action_value = 'reject' then
    if payment_row.status not in ('pending', 'needs_review') then raise exception 'This request cannot be rejected'; end if;
    if p_rejection_category not in ('amount_mismatch', 'transaction_not_found', 'duplicate_transaction', 'recipient_mismatch', 'invalid_details', 'other') then raise exception 'Choose a rejection reason category'; end if;
    if char_length(student_message_en_value) not between 5 and 500 or char_length(student_message_bn_value) not between 5 and 500 then
      raise exception 'Provide a safe rejection explanation in English and Bangla';
    end if;
    new_status := 'rejected';
  elsif action_value = 'cancel' then
    if payment_row.cancellation_requested_at is null then raise exception 'A student cancellation request is required before closing this payment request'; end if;
    update public.payment_submissions
    set cancelled_at = now(), cancellation_resolution_note = internal_note_value,
        reviewed_by = actor_id, reviewed_at = now(), review_note = internal_note_value, updated_at = now()
    where id = payment_row.id;
    after_json := jsonb_build_object('status', 'cancelled', 'cancelled_at', now());
    before_json := jsonb_build_object('status', payment_row.status::text, 'cancellation_requested_at', payment_row.cancellation_requested_at);
    insert into public.payment_audit_events (payment_submission_id, actor_user_id, action, before_state, after_state)
    values (payment_row.id, actor_id, 'payment_request.cancelled', before_json, after_json);
    insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (actor_id, 'payment_request.cancelled', 'payment_submission', payment_row.id, before_json, after_json);
    select coalesce(p.ui_language, 'en') into ui_language_value from public.profiles p where p.user_id = payment_row.user_id;
    insert into public.notifications (user_id, notification_type, title, body, href)
    values (payment_row.user_id, 'generic',
      case when ui_language_value = 'bn' then 'পেমেন্টের অনুরোধ বাতিল হয়েছে' else 'Payment request cancelled' end,
      case when ui_language_value = 'bn' then 'আপনার অনুরোধ যাচাই করে বন্ধ করা হয়েছে।' else 'Your request was reviewed and closed.' end,
      '/payments');
    return jsonb_build_object('id', payment_row.id, 'status', 'cancelled', 'entitlement_id', null);
  end if;

  update public.payment_submissions
  set status = new_status,
      reviewed_by = actor_id,
      reviewed_at = case when new_status in ('verified', 'rejected') then now() else reviewed_at end,
      review_note = internal_note_value,
      cancellation_requested_at = case when new_status = 'verified' then null else cancellation_requested_at end,
      cancellation_resolution_note = case when new_status = 'verified' and payment_row.cancellation_requested_at is not null then internal_note_value else cancellation_resolution_note end,
      rejection_category = case when new_status = 'rejected' then p_rejection_category else null end,
      student_message_en = case when new_status = 'rejected' then student_message_en_value else null end,
      student_message_bn = case when new_status = 'rejected' then student_message_bn_value else null end,
      updated_at = now()
  where id = payment_row.id;

  before_json := jsonb_build_object('status', payment_row.status::text, 'reviewed_at', payment_row.reviewed_at);
  after_json := jsonb_build_object('status', new_status::text, 'reviewed_at', case when new_status in ('verified', 'rejected') then now() else null end,
    'rejection_category', case when new_status = 'rejected' then p_rejection_category else null end,
    'cancellation_request_resolved', new_status = 'verified' and payment_row.cancellation_requested_at is not null);
  insert into public.payment_audit_events (payment_submission_id, actor_user_id, action, before_state, after_state)
  values (payment_row.id, actor_id, 'payment_request.' || action_value, before_json, after_json);
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_id, 'payment_request.' || action_value, 'payment_submission', payment_row.id, before_json, after_json);

  if new_status in ('verified', 'rejected') then
    select coalesce(p.ui_language, 'en') into ui_language_value from public.profiles p where p.user_id = payment_row.user_id;
    if new_status = 'verified' then
      insert into public.notifications (user_id, notification_type, title, body, href)
      values (
        payment_row.user_id, 'payment_approved',
        case when ui_language_value = 'bn' then 'পেমেন্ট যাচাই হয়েছে' else 'Payment verified' end,
        case when ui_language_value = 'bn' then 'আপনার পেমেন্ট যাচাই হয়েছে। অ্যাকাউন্টে প্রবেশাধিকারের মেয়াদ দেখুন।' else 'Your payment was verified. Check your account for the access period.' end,
        '/subscription'
      );
    else
      insert into public.notifications (user_id, notification_type, title, body, href)
      values (
        payment_row.user_id, 'payment_rejected',
        case when ui_language_value = 'bn' then 'পেমেন্টে মনোযোগ প্রয়োজন' else 'Payment needs attention' end,
        case when ui_language_value = 'bn' then student_message_bn_value else student_message_en_value end,
        '/payments'
      );
    end if;
  end if;

  return jsonb_build_object('id', payment_row.id, 'status', new_status::text, 'entitlement_id', entitlement_id, 'idempotent', false);
end;
$$;

revoke all on function public.get_payment_checkout_options() from public, anon;
revoke all on function public.get_admin_payment_settings() from public, anon;
revoke all on function public.save_admin_payment_settings(boolean, text, text, text, text, text, boolean, text) from public, anon;
revoke all on function public.get_admin_payment_plans() from public, anon;
revoke all on function public.save_admin_payment_plan(text, text, text, numeric, integer, jsonb, boolean) from public, anon;
revoke all on function public.create_payment_request(uuid, text, text, text, text, timestamptz, text, boolean, uuid) from public, anon;
revoke all on function public.request_payment_cancellation(uuid) from public, anon;
revoke all on function public.get_admin_payment_review_queue(text, date, date, text) from public, anon;
revoke all on function public.get_admin_payment_detail(uuid, boolean) from public, anon;
revoke all on function public.review_payment_request(uuid, text, text, text, text, text) from public, anon;

grant execute on function public.get_payment_checkout_options() to authenticated;
grant execute on function public.get_admin_payment_settings() to authenticated;
grant execute on function public.save_admin_payment_settings(boolean, text, text, text, text, text, boolean, text) to authenticated;
grant execute on function public.get_admin_payment_plans() to authenticated;
grant execute on function public.save_admin_payment_plan(text, text, text, numeric, integer, jsonb, boolean) to authenticated;
grant execute on function public.create_payment_request(uuid, text, text, text, text, timestamptz, text, boolean, uuid) to authenticated;
grant execute on function public.request_payment_cancellation(uuid) to authenticated;
grant execute on function public.get_admin_payment_review_queue(text, date, date, text) to authenticated;
grant execute on function public.get_admin_payment_detail(uuid, boolean) to authenticated;
grant execute on function public.review_payment_request(uuid, text, text, text, text, text) to authenticated;

commit;
