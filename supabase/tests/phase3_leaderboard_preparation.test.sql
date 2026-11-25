begin;

select plan(31);

insert into auth.users (id, email)
values
  ('71000000-0000-4000-8000-000000000001', 'board-a@example.test'),
  ('71000000-0000-4000-8000-000000000002', 'board-b@example.test'),
  ('71000000-0000-4000-8000-000000000003', 'board-c@example.test'),
  ('71000000-0000-4000-8000-000000000004', 'board-d@example.test'),
  ('71000000-0000-4000-8000-000000000005', 'board-open@example.test'),
  ('71000000-0000-4000-8000-000000000006', 'board-in-progress@example.test');

update public.profiles set display_name = 'Candidate account'
where user_id = '71000000-0000-4000-8000-000000000005';

insert into public.exam_blueprints (id, level, version, status, created_by)
values ('72000000-0000-4000-8000-000000000001', 'N1', 998, 'draft', '71000000-0000-4000-8000-000000000005');

insert into public.blueprint_slots (
  id, blueprint_id, slot_order, test_section_code, score_category_code,
  item_type_code, question_quota, section_duration_seconds
)
values (
  '73000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001', 1, 'vocabulary', 'language_knowledge',
  'word_formation', 1, 60
);

update public.exam_blueprints set status = 'approved'
where id = '72000000-0000-4000-8000-000000000001';

insert into public.questions (
  id, content_key, revision, level, test_section_code, score_category_code,
  item_type_code, prompt, options, status, authored_by
)
values (
  '74000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000001', 1, 'N1', 'vocabulary', 'language_knowledge',
  'word_formation',
  '[{"type":"text","text":"日本語の質問です。"}]'::jsonb,
  '[{"id":"A","content":[{"type":"text","text":"答え一"}]},{"id":"B","content":[{"type":"text","text":"答え二"}]}]'::jsonb,
  'eligible_for_exam', '71000000-0000-4000-8000-000000000005'
);

insert into public.question_answer_keys (question_id, correct_option_id, explanation)
values ('74000000-0000-4000-8000-000000000001', 'A', '{}'::jsonb);

insert into public.exam_forms (
  id, blueprint_id, level, form_code, version, status, is_frozen,
  published_at, access_tier, created_by
)
values (
  '76000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001', 'N1', 'N1-PHASE3-TEST', 998,
  'draft', false, null, 'free', '71000000-0000-4000-8000-000000000005'
);

insert into public.exam_form_items (id, exam_form_id, question_id, position)
values (
  '77000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000001', 1
);

update public.exam_forms
set status = 'published', is_frozen = true, published_at = now()
where id = '76000000-0000-4000-8000-000000000001';

insert into public.exam_attempts (
  id, user_id, exam_form_id, level, status, attempt_number,
  started_at, deadline_at, submitted_at
)
values
  ('78000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000001', 'N1', 'submitted', 1, now() - interval '6 days', now() - interval '5 days', now() - interval '5 days'),
  ('78000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000001', 'N1', 'submitted', 2, now() - interval '2 days', now() - interval '2 days' + interval '1 hour', now() - interval '2 days'),
  ('78000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000002', '76000000-0000-4000-8000-000000000001', 'N1', 'submitted', 1, now() - interval '3 days', now() - interval '3 days' + interval '1 hour', now() - interval '3 days'),
  ('78000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000003', '76000000-0000-4000-8000-000000000001', 'N1', 'submitted', 1, now() - interval '1 day', now() - interval '1 day' + interval '1 hour', now() - interval '1 day'),
  ('78000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000004', '76000000-0000-4000-8000-000000000001', 'N1', 'submitted', 1, now() - interval '40 days', now() - interval '40 days' + interval '1 hour', now() - interval '40 days'),
  ('78000000-0000-4000-8000-000000000006', '71000000-0000-4000-8000-000000000006', '76000000-0000-4000-8000-000000000001', 'N1', 'in_progress', 1, now(), now() + interval '1 hour', null);

insert into public.exam_results (attempt_id, raw_correct, raw_incorrect, raw_unanswered, section_breakdown, score_category_breakdown)
values
  ('78000000-0000-4000-8000-000000000001', 6, 4, 0, '{}'::jsonb, '{}'::jsonb),
  ('78000000-0000-4000-8000-000000000002', 9, 1, 0, '{}'::jsonb, '{}'::jsonb),
  ('78000000-0000-4000-8000-000000000003', 9, 1, 0, '{}'::jsonb, '{}'::jsonb),
  ('78000000-0000-4000-8000-000000000004', 8, 2, 0, '{}'::jsonb, '{}'::jsonb),
  ('78000000-0000-4000-8000-000000000005', 10, 0, 0, '{}'::jsonb, '{}'::jsonb),
  ('78000000-0000-4000-8000-000000000006', 10, 0, 0, '{}'::jsonb, '{}'::jsonb);

select ok(not has_function_privilege('anon', 'public.get_student_leaderboard(public.jlpt_level,text,integer)', 'execute'), 'anonymous visitors cannot call the learner leaderboard RPC');
select ok(has_function_privilege('authenticated', 'public.get_student_leaderboard(public.jlpt_level,text,integer)', 'execute'), 'authenticated learners can call the leaderboard RPC');

set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000001';

select is((select count(*) from public.get_student_leaderboard('N1', 'all_time', 10)), 4::bigint, 'all-time ranking includes one best completed result per learner and omits an in-progress attempt');
select is((select learner_alias from public.get_student_leaderboard('N1', 'all_time', 10) order by rank limit 1), 'Learner ' || upper(substr(md5('71000000-0000-4000-8000-000000000004'), 1, 6)), 'the highest completed score ranks first under a pseudonym');
select is((select rank from public.get_student_leaderboard('N1', 'all_time', 10) where is_current_user), 3::bigint, 'the current learner is ranked by their best result, not their earlier attempt');
select is((select raw_correct from public.get_student_leaderboard('N1', 'all_time', 10) where is_current_user), 9, 'only the learner’s strongest completed attempt is used');
select is((select count(*) from public.get_student_leaderboard('N1', '7d', 10)), 3::bigint, 'the seven-day filter excludes older results');
select is((select count(*) from public.get_student_leaderboard('N1', '30d', 10)), 3::bigint, 'the thirty-day filter excludes older results');
select is((select count(*) from public.get_student_leaderboard('N1', 'all_time', 2)), 3::bigint, 'a learner outside the displayed top two still receives their own rank row');
select ok((select rank = 3 from public.get_student_leaderboard('N1', 'all_time', 2) where is_current_user), 'the included personal row keeps its actual rank');
select ok((select bool_and(learner_alias ~ '^Learner [A-F0-9]{6}$') from public.get_student_leaderboard('N1', 'all_time', 10)), 'all ranked learners receive pseudonyms');
select ok((select bool_and(not (to_jsonb(board_row) ?| array['user_id', 'email', 'phone', 'attempt_id'])) from public.get_student_leaderboard('N1', 'all_time', 10) board_row), 'leaderboard rows expose no user identifiers or private contact details');
select is((select count(*) from public.exam_attempts where user_id <> auth.uid()), 0::bigint, 'the normal attempt table still hides other learners’ private attempt records');
select is((select count(*) from public.get_student_leaderboard('N4', 'all_time', 10)), 0::bigint, 'the level filter does not mix results from another JLPT level');

reset role;
reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000005';

select ok(public.start_exam_attempt('76000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000001') is not null, 'a newly started attempt begins at its cover flow');
select is((select preparation_required from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), true, 'new attempts require candidate details and preparation');
select is((select started_at from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), null::timestamptz, 'the timed exam does not start on the cover page');
select is((select count(*) from public.attempt_sections s join public.exam_attempts a on a.id = s.attempt_id where a.user_id = auth.uid() and s.status = 'active'), 0::bigint, 'no timed section opens before preparation');
select is((select candidate_name from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 'Candidate account', 'the cover pre-fills the learner display name');
select is(jsonb_array_length(public.get_exam_attempt_payload((select id from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'))->'questions'), 0, 'the cover payload contains no questions or answer bubbles');
select ok(public.begin_exam_preparation((select id from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 'Exam Candidate', 'N5-42') is not null, 'candidate confirmation starts preparation');
select is((select extract(epoch from (preparation_deadline_at - preparation_started_at))::integer from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 300, 'preparation is exactly five server-timed minutes');
select is((select candidate_name from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 'Exam Candidate', 'confirmed candidate name is persisted on the attempt');
select is((select candidate_number from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 'N5-42', 'optional candidate number is persisted on the attempt');
select is(public.begin_exam_preparation((select id from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 'Different Name', null), (select preparation_deadline_at from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 'repeating preparation start is idempotent');
select is((select candidate_name from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'), 'Exam Candidate', 'an idempotent retry cannot change saved candidate details');
select throws_ok('select public.submit_exam_attempt((select id from public.exam_attempts where user_id = auth.uid() and status = ''in_progress''))', 'P0001', 'Complete the preparation window before submitting the exam', 'the server rejects submission before preparation ends');
select is(jsonb_array_length(public.get_exam_attempt_payload((select id from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'))->'questions'), 0, 'questions remain locked throughout preparation');
select is(public.start_exam_attempt('76000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000001'), public.start_exam_attempt('76000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000001'), 'repeating the start request does not create another attempt');

reset role;
reset request.jwt.claim.sub;
update public.exam_attempts
set preparation_deadline_at = now() - interval '1 second'
where user_id = '71000000-0000-4000-8000-000000000005' and status = 'in_progress';

set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000005';

select is(public.get_exam_attempt_payload((select id from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'))->'active_section'->>'section_code', 'vocabulary', 'the server opens the first section after the preparation deadline');
select is(jsonb_array_length(public.get_exam_attempt_payload((select id from public.exam_attempts where user_id = auth.uid() and status = 'in_progress'))->'questions'), 1, 'the first question becomes available only after server catch-up');

select * from finish();
rollback;
