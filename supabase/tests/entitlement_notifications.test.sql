begin;

select plan(12);

insert into auth.users (id, email)
values
  ('41000000-0000-4000-8000-000000000001', 'expiry-bangla@example.test'),
  ('41000000-0000-4000-8000-000000000002', 'expiry-ended@example.test'),
  ('41000000-0000-4000-8000-000000000003', 'expiry-future@example.test');

update public.profiles set ui_language = 'bn'
where user_id = '41000000-0000-4000-8000-000000000001';

insert into public.plans (id, code, name, name_bn, price, currency, duration_days, is_active)
values ('42000000-0000-4000-8000-000000000001', 'expiry-test', 'Expiry test', 'মেয়াদ পরীক্ষা', 0, 'BDT', 30, false);

insert into public.user_entitlements (id, user_id, plan_id, status, starts_at, ends_at)
values
  -- Both rows fall inside the reminder window. Only the latest row is the effective expiry.
  ('43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'active', now() - interval '30 days', now() + interval '2 days'),
  ('43000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'active', now() + interval '2 days', now() + interval '5 days'),
  ('43000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 'active', now() - interval '35 days', now() - interval '3 days'),
  ('43000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000001', 'active', now(), now() + interval '31 days');

set local role service_role;

create temporary table expiry_test_run on commit drop as
select public.process_entitlement_notifications(7, 50) as result;

select is(
  (select result ->> 'expiring_created' from expiry_test_run),
  '1',
  'the worker creates one reminder for the latest entitlement in the configured window'
);
select is(
  (select result ->> 'expired_created' from expiry_test_run),
  '1',
  'the worker creates one notice for the expired entitlement on its first run'
);
select is(
  (select count(*) from public.notifications where user_id = '41000000-0000-4000-8000-000000000001' and notification_type = 'premium_expiring'),
  1::bigint,
  'the learner receives one expiring notice even when older entitlement rows are also due'
);
select is(
  (select title from public.notifications where user_id = '41000000-0000-4000-8000-000000000001' and notification_type = 'premium_expiring'),
  'প্রিমিয়াম প্রবেশাধিকারের মেয়াদ শেষ হতে চলেছে',
  'the expiry reminder uses the learner preference language'
);
select is(
  (select count(*) from public.notifications where user_id = '41000000-0000-4000-8000-000000000002' and notification_type = 'premium_expired'),
  1::bigint,
  'the worker creates a notice for an expired latest entitlement'
);
select is(
  (select count(*) from public.notifications where user_id = '41000000-0000-4000-8000-000000000003'),
  0::bigint,
  'an entitlement outside the reminder window receives no notice'
);
select is(
  public.process_entitlement_notifications(7, 50) ->> 'expiring_created',
  '0',
  'rerunning the worker does not duplicate the expiring notice'
);
select is(
  public.process_entitlement_notifications(7, 50) ->> 'expired_created',
  '0',
  'rerunning the worker does not duplicate the expired notice'
);
select throws_ok(
  'select public.process_entitlement_notifications(31, 50)',
  'P0001', null,
  'the database rejects reminder windows outside the supported range'
);

reset role;
set local role authenticated;

select throws_ok(
  'select public.process_entitlement_notifications(7, 50)',
  '42501', null,
  'learners cannot invoke the service-only notification worker'
);
select throws_ok(
  'select * from private.entitlement_notification_deliveries',
  '42501', null,
  'learners cannot read the private idempotency ledger'
);

reset role;
select is((select count(*) from private.entitlement_notification_deliveries), 2::bigint, 'the private ledger records exactly the two delivered events');

select * from finish();
rollback;
