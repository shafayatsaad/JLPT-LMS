-- Optional, private bKash receipt images. A receipt never verifies payment.
-- Apply after migration 025 and only after reconciling the hosted migration ledger.

begin;

alter table public.payment_submissions
  add column receipt_storage_path text,
  add column receipt_upload_started_at timestamptz,
  add column receipt_uploaded_at timestamptz,
  add constraint payment_receipt_timestamp_requires_path
    check (receipt_uploaded_at is null or (receipt_storage_path is not null and receipt_upload_started_at is not null)),
  add constraint payment_receipt_reservation_requires_path
    check ((receipt_storage_path is null) = (receipt_upload_started_at is null));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jlpt-payment-receipts', 'jlpt-payment-receipts', false, 4194304,
  array['image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "payment receipts: owner or payment staff read attached files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'jlpt-payment-receipts'
    and exists (
      select 1
      from public.payment_submissions ps
      where ps.id::text = (storage.foldername(name))[2]
        and ps.user_id::text = (storage.foldername(name))[1]
        and ps.receipt_storage_path = name
        and ps.receipt_uploaded_at is not null
        and (
          ps.user_id = (select auth.uid())
          or (select private.has_any_role(array[
            'admin'::public.app_role,
            'payment_reviewer'::public.app_role
          ]))
        )
    )
  );

create policy "payment receipts: owner uploads reserved file"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'jlpt-payment-receipts'
    and exists (
      select 1
      from public.payment_submissions ps
      where ps.id::text = (storage.foldername(name))[2]
        and ps.user_id = (select auth.uid())
        and ps.receipt_storage_path = name
        and ps.receipt_upload_started_at is not null
        and ps.receipt_uploaded_at is null
    )
  );

create policy "payment receipts: owner removes unfinished upload"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'jlpt-payment-receipts'
    and exists (
      select 1
      from public.payment_submissions ps
      where ps.id::text = (storage.foldername(name))[2]
        and ps.user_id = (select auth.uid())
        and ps.receipt_storage_path = name
        and ps.receipt_upload_started_at is not null
        and ps.receipt_uploaded_at is null
    )
  );

create or replace function public.begin_payment_receipt_upload(
  p_payment_submission_id uuid,
  p_storage_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  payment_row public.payment_submissions%rowtype;
  folders text[] := storage.foldername(p_storage_path);
  filename text := storage.filename(p_storage_path);
begin
  if actor_id is null then raise exception 'Sign in to attach a receipt'; end if;
  if folders is null or array_length(folders, 1) <> 2
    or folders[1] <> actor_id::text
    or folders[2] <> p_payment_submission_id::text
    or filename !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.webp$'
  then
    raise exception 'Receipt storage path is invalid';
  end if;

  select * into payment_row
  from public.payment_submissions
  where id = p_payment_submission_id and user_id = actor_id
  for update;
  if not found then raise exception 'Payment request is unavailable'; end if;
  if payment_row.status not in ('pending', 'needs_review') or payment_row.cancelled_at is not null then
    raise exception 'Receipt upload is no longer available for this request';
  end if;
  if payment_row.receipt_storage_path is not null then
    raise exception 'A receipt has already been attached or is being uploaded';
  end if;

  update public.payment_submissions
  set receipt_storage_path = p_storage_path,
      receipt_upload_started_at = clock_timestamp(),
      receipt_uploaded_at = null,
      updated_at = clock_timestamp()
  where id = p_payment_submission_id;
end;
$$;

create or replace function public.complete_payment_receipt_upload(
  p_payment_submission_id uuid,
  p_storage_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Sign in to attach a receipt'; end if;

  perform 1
  from public.payment_submissions ps
  where ps.id = p_payment_submission_id
    and ps.user_id = actor_id
    and ps.receipt_storage_path = p_storage_path
    and ps.status in ('pending', 'needs_review')
    and ps.cancelled_at is null
  for update;
  if not found then raise exception 'Receipt upload is unavailable'; end if;

  if exists (
    select 1 from public.payment_submissions ps
    where ps.id = p_payment_submission_id and ps.receipt_uploaded_at is not null
  ) then
    return;
  end if;

  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'jlpt-payment-receipts' and so.name = p_storage_path
  ) then
    raise exception 'Receipt file was not uploaded';
  end if;

  update public.payment_submissions
  set receipt_uploaded_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_payment_submission_id;

  insert into public.payment_audit_events (payment_submission_id, actor_user_id, action, after_state)
  values (p_payment_submission_id, actor_id, 'receipt.attached', jsonb_build_object('receipt_attached', true));
end;
$$;

create or replace function public.clear_payment_receipt_upload(
  p_payment_submission_id uuid,
  p_storage_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then raise exception 'Sign in to manage this receipt'; end if;
  if exists (
    select 1 from storage.objects so
    where so.bucket_id = 'jlpt-payment-receipts' and so.name = p_storage_path
  ) then
    raise exception 'Remove the unfinished receipt file before clearing its reservation';
  end if;

  update public.payment_submissions
  set receipt_storage_path = null,
      receipt_upload_started_at = null,
      receipt_uploaded_at = null,
      updated_at = clock_timestamp()
  where id = p_payment_submission_id
    and user_id = actor_id
    and receipt_storage_path = p_storage_path
    and receipt_upload_started_at is not null
    and receipt_uploaded_at is null;
end;
$$;

create or replace function public.get_admin_payment_receipt_path(p_payment_submission_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  receipt_path text;
begin
  if actor_id is null or not (select private.has_any_role(array[
    'admin'::public.app_role,
    'payment_reviewer'::public.app_role
  ])) then
    raise exception 'Payment receipt access is required';
  end if;

  select ps.receipt_storage_path into receipt_path
  from public.payment_submissions ps
  where ps.id = p_payment_submission_id
    and ps.user_id <> actor_id
    and ps.receipt_uploaded_at is not null;
  if receipt_path is null then return null; end if;

  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, after_state)
  values (actor_id, 'payment_receipt.accessed', 'payment_submission', p_payment_submission_id,
    jsonb_build_object('receipt_available', true));
  return receipt_path;
end;
$$;

revoke all on function public.begin_payment_receipt_upload(uuid, text) from public, anon;
revoke all on function public.complete_payment_receipt_upload(uuid, text) from public, anon;
revoke all on function public.clear_payment_receipt_upload(uuid, text) from public, anon;
revoke all on function public.get_admin_payment_receipt_path(uuid) from public, anon;

grant execute on function public.begin_payment_receipt_upload(uuid, text) to authenticated;
grant execute on function public.complete_payment_receipt_upload(uuid, text) to authenticated;
grant execute on function public.clear_payment_receipt_upload(uuid, text) to authenticated;
grant execute on function public.get_admin_payment_receipt_path(uuid) to authenticated;

commit;
