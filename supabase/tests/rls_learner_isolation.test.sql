begin;

select plan(14);

-- These fixtures exercise the policies as real API roles. The Auth trigger also
-- proves that a newly created learner receives only their own profile and role.
insert into auth.users (id, email)
values
  ('11000000-0000-4000-8000-000000000001', 'rls-learner-one@example.test'),
  ('11000000-0000-4000-8000-000000000002', 'rls-learner-two@example.test');

insert into public.exam_blueprints (id, level, version, status, created_by)
values ('22000000-0000-4000-8000-000000000001', 'N5', 999, 'approved', '11000000-0000-4000-8000-000000000001');

insert into public.exam_forms (id, blueprint_id, level, form_code, version, status, is_frozen, published_at, created_by)
values ('33000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'N5', 'RLS-TEST-PUBLISHED-001', 999, 'published', true, now(), '11000000-0000-4000-8000-000000000001');

insert into public.questions (id, content_key, revision, level, test_section_code, score_category_code, item_type_code, prompt, options, status, authored_by)
values ('66000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000002', 1, 'N5', 'language_knowledge', 'vocabulary', 'kanji_reading', '[]'::jsonb, '[{"id":"A","text":"sample"},{"id":"B","text":"sample"}]'::jsonb, 'approved', '11000000-0000-4000-8000-000000000001');

insert into public.question_answer_keys (question_id, correct_option_id, explanation)
values ('66000000-0000-4000-8000-000000000001', 'A', '{"en":"Sample explanation."}'::jsonb);

insert into public.exam_form_items (id, exam_form_id, question_id, position)
values ('34000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000001', 1);

insert into public.exam_attempts (id, user_id, exam_form_id, level, status, attempt_number, started_at, submitted_at)
values
  ('44000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'N5', 'submitted', 1, now() - interval '2 minutes', now()),
  ('44000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'N5', 'in_progress', 2, now() - interval '1 minute', null),
  ('44000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', 'N5', 'submitted', 1, now() - interval '2 minutes', now());

insert into public.exam_results (id, attempt_id, raw_correct, raw_incorrect, raw_unanswered, section_breakdown, score_category_breakdown)
values
  ('55000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', 1, 0, 0, '{}'::jsonb, '{}'::jsonb),
  ('55000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000002', 0, 0, 1, '{}'::jsonb, '{}'::jsonb),
  ('55000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000003', 0, 1, 0, '{}'::jsonb, '{}'::jsonb);

insert into public.attempt_answers (id, attempt_id, question_id, exam_form_item_id, selected_option_id)
values
  ('77000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'A'),
  ('77000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000002', '66000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'B'),
  ('77000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000003', '66000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'A');

set local role authenticated;
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000001';

select is((select count(*) from public.profiles where user_id in ('11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002')), 1::bigint, 'a learner can read their own profile but not another learner profile');
select is((select count(*) from public.user_roles where user_id in ('11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002')), 1::bigint, 'a learner can read their own role but not another learner role');
select is((with changed as (update public.profiles set display_name = 'unauthorized change' where user_id = '11000000-0000-4000-8000-000000000002' returning 1) select count(*) from changed), 0::bigint, 'a learner cannot update another learner profile');
select is((select count(*) from public.exam_attempts where user_id in ('11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002')), 2::bigint, 'a learner can read their own attempts but not another learner attempt');
select is((select count(*) from public.exam_results where attempt_id in ('44000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000003')), 1::bigint, 'a learner sees results only for their completed attempts');
select is((select count(*) from public.attempt_answers where attempt_id in ('44000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000003')), 1::bigint, 'a learner sees answers only for their completed attempts');
select is((select count(*) from public.attempt_answers where id = '77000000-0000-4000-8000-000000000001' and selected_option_id = 'A'), 1::bigint, 'a learner can review their own submitted answer');
select is((select count(*) from public.attempt_answers where id in ('77000000-0000-4000-8000-000000000002', '77000000-0000-4000-8000-000000000003')), 0::bigint, 'in-progress and other-learner answers remain hidden');
select throws_ok('select question_id from public.question_answer_keys where question_id = ''66000000-0000-4000-8000-000000000001''', '42501', null, 'learners cannot query protected answer keys');

reset role;
reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '11000000-0000-4000-8000-000000000002';

select is((select count(*) from public.profiles where user_id in ('11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002')), 1::bigint, 'the second learner is limited to their own profile');
select is((select count(*) from public.exam_attempts where user_id in ('11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002')), 1::bigint, 'the second learner is limited to their own attempt history');
select is((select count(*) from public.exam_results where attempt_id in ('44000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000003')), 1::bigint, 'the second learner is limited to their own result');
select is((select count(*) from public.attempt_answers where id in ('77000000-0000-4000-8000-000000000001', '77000000-0000-4000-8000-000000000003')), 1::bigint, 'the second learner is limited to their own submitted answers');
select is((select count(*) from public.profiles where user_id = '11000000-0000-4000-8000-000000000002'), 1::bigint, 'the second learner can access their own row');

select * from finish();
rollback;
