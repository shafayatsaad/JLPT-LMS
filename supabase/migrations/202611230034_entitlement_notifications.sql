-- Idempotent in-app premium expiry notices. Email delivery stays separate and disabled.

begin;

create table private.entitlement_notification_deliveries (
  entitlement_id uuid not null references public.user_entitlements(id) on delete cascade,
  notification_type text not null check (notification_type in ('premium_expiring', 'premium_expired')),
  delivered_at timestamptz not null default now(),
  primary key (entitlement_id, notification_type)
);
revoke all on table private.entitlement_notification_deliveries from public, anon, authenticated, service_role;

comment on table private.entitlement_notification_deliveries is
  'Private idempotency ledger for scheduled in-app premium expiry notices; no email is sent by this workflow.';

create or replace function public.process_entitlement_notifications(
  p_expiring_days integer default 7,
  p_limit integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reminder_days integer := coalesce(p_expiring_days, 7);
  batch_limit integer := greatest(1, least(coalesce(p_limit, 250), 500));
  candidate record;
  language_code text;
  title_value text;
  body_value text;
  expiring_created integer := 0;
  expired_created integer := 0;
begin
  if reminder_days not between 1 and 30 then
    raise exception 'Reminder window must be between 1 and 30 days';
  end if;

  for candidate in
    with latest_entitlement as (
      select distinct on (ue.user_id)
        ue.id, ue.user_id, ue.ends_at
      from public.user_entitlements ue
      where ue.status = 'active'::public.entitlement_status
      order by ue.user_id, ue.ends_at desc, ue.created_at desc, ue.id desc
    ), due_notices as (
      select le.id as entitlement_id, le.user_id, le.ends_at, 'premium_expiring'::text as notification_type
      from latest_entitlement le
      where le.ends_at > now()
        and le.ends_at <= now() + make_interval(days => reminder_days)
      union all
      select le.id as entitlement_id, le.user_id, le.ends_at, 'premium_expired'::text as notification_type
      from latest_entitlement le
      where le.ends_at <= now()
    )
    select due.*
    from due_notices due
    where not exists (
      select 1
      from private.entitlement_notification_deliveries sent
      where sent.entitlement_id = due.entitlement_id
        and sent.notification_type = due.notification_type
    )
    order by due.ends_at, due.notification_type, due.user_id
    limit batch_limit
  loop
    insert into private.entitlement_notification_deliveries (entitlement_id, notification_type)
    values (candidate.entitlement_id, candidate.notification_type)
    on conflict (entitlement_id, notification_type) do nothing;
    if not found then continue; end if;

    language_code := 'en';
    select p.ui_language into language_code
    from public.profiles p
    where p.user_id = candidate.user_id;
    language_code := coalesce(language_code, 'en');

    if candidate.notification_type = 'premium_expiring' then
      title_value := case when language_code = 'bn' then 'প্রিমিয়াম প্রবেশাধিকারের মেয়াদ শেষ হতে চলেছে' else 'Premium access expires soon' end;
      body_value := case when language_code = 'bn'
        then 'আপনার প্রিমিয়াম প্রবেশাধিকারের মেয়াদ শিগগির শেষ হবে। শেষ তারিখ দেখতে অ্যাকাউন্টের প্রবেশাধিকার দেখুন।'
        else 'Your premium access period will end soon. Check your account for the end date.' end;
      expiring_created := expiring_created + 1;
    else
      title_value := case when language_code = 'bn' then 'প্রিমিয়াম প্রবেশাধিকারের মেয়াদ শেষ হয়েছে' else 'Premium access ended' end;
      body_value := case when language_code = 'bn'
        then 'আপনার প্রিমিয়াম প্রবেশাধিকারের মেয়াদ শেষ হয়েছে। বর্তমান প্রবেশাধিকার দেখতে অ্যাকাউন্ট দেখুন।'
        else 'Your premium access period has ended. Check your account for current access.' end;
      expired_created := expired_created + 1;
    end if;

    insert into public.notifications (user_id, notification_type, title, body, href)
    values (candidate.user_id, candidate.notification_type, title_value, body_value, '/subscription');
  end loop;

  return jsonb_build_object(
    'expiring_created', expiring_created,
    'expired_created', expired_created
  );
end;
$$;

revoke all on function public.process_entitlement_notifications(integer, integer) from public, anon, authenticated;
grant execute on function public.process_entitlement_notifications(integer, integer) to service_role;

commit;
