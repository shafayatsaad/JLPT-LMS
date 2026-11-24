begin;

select plan(25);

insert into auth.users (id, email)
values
  ('12000000-0000-4000-8000-000000000001', 'services-learner-one@example.test'),
  ('12000000-0000-4000-8000-000000000002', 'services-learner-two@example.test');

insert into public.notifications (id, user_id, notification_type, title, body)
values
  ('82000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'security_notice', 'Account notice', 'A security notice for learner one.'),
  ('82000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 'security_notice', 'Account notice', 'A security notice for learner two.');

insert into public.support_tickets (id, user_id, category, subject)
values
  ('92000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'account', 'Learner one ticket'),
  ('92000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 'account', 'Learner two ticket');

insert into public.support_messages (id, ticket_id, sender_user_id, sender_side, body, is_internal)
values
  ('a2000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'student', 'A public learner one message.', false),
  ('a2000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'staff', 'An internal staff note.', true),
  ('a2000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 'student', 'A public learner two message.', false);

insert into public.support_attachments (id, message_id, ticket_id, uploaded_by, storage_path, status, stored_bytes, attached_at)
values
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'test/learner-one.webp', 'attached', 120, now()),
  ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'test/internal-note.webp', 'attached', 120, now()),
  ('b2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 'test/learner-two.webp', 'attached', 120, now());

set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000001';

select is((select count(*) from public.notifications where id in ('82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002')), 1::bigint, 'a learner reads only their own notifications');
select ok(public.mark_notification_read('82000000-0000-4000-8000-000000000001'), 'a learner can mark their own notification read');
select is(public.mark_notification_read('82000000-0000-4000-8000-000000000002'), false, 'a learner cannot mark another learner notification read');
select is((select count(*) from public.support_tickets where id in ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002')), 1::bigint, 'a learner reads only their own support ticket');
select is((select count(*) from public.support_messages where id in ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000003')), 1::bigint, 'a learner sees public messages on their ticket but not internal or other-learner messages');
select is((select count(*) from public.support_attachments where id in ('b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000003')), 1::bigint, 'a learner sees only attachments on their public support messages');
select is((select in_app_exam_updates from public.get_my_notification_preferences()), true, 'a learner gets the default exam notification preference');
select is((select email_learning_updates from public.get_my_notification_preferences()), false, 'optional learning email starts disabled');
select ok(public.save_my_notification_preferences(false, true, false, true) is not null, 'a learner can save only their own notification preferences');
select is((select email_product_news from public.get_my_notification_preferences()), true, 'a saved learner email preference is returned to that learner');
select throws_ok('select * from public.user_notification_preferences', '42501', null, 'notification preference rows cannot be queried directly');
select is(public.request_account_deletion() ->> 'status', 'received', 'a learner can request account deletion review');
select is((select count(*) from public.account_deletion_requests), 1::bigint, 'a learner reads only their own privacy request');

reset role;
reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000002';

select is((select count(*) from public.notifications where id in ('82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002')), 1::bigint, 'the second learner reads only their own notifications');
select is(public.mark_notification_read('82000000-0000-4000-8000-000000000001'), false, 'the second learner cannot mark the first learner notification read');
select is((select read_at is null from public.notifications where id = '82000000-0000-4000-8000-000000000002'), true, 'the second learner notification remains unread');
select is((select count(*) from public.support_tickets where id in ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002')), 1::bigint, 'the second learner reads only their own support ticket');
select is((select count(*) from public.support_messages where id in ('a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000003')), 1::bigint, 'the second learner cannot read another ticket or its internal messages');
select is((select count(*) from public.support_attachments where id in ('b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000003')), 1::bigint, 'the second learner sees only their own public attachment');
select is((select email_product_news from public.get_my_notification_preferences()), false, 'the second learner cannot read the first learner saved preferences');
select is(public.request_account_deletion() ->> 'status', 'received', 'the second learner can create their own privacy request');
select is((select count(*) from public.account_deletion_requests), 1::bigint, 'the second learner reads only their own privacy request');

reset role;
reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-4000-8000-000000000001';

select is((select count(*) from public.account_deletion_requests where user_id in ('12000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000002')), 1::bigint, 'the first learner cannot see the second learner privacy request');
select throws_ok('update public.account_deletion_requests set status = ''withdrawn'' where user_id = ''12000000-0000-4000-8000-000000000002''', '42501', null, 'learners cannot directly change account deletion request status');
select throws_ok('select public.get_admin_account_deletion_requests(null)', 'P0001', 'Administrator access is required', 'a learner cannot access the admin privacy queue');

select * from finish();
rollback;
