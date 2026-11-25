-- Test-only sign-in profiles. This file is loaded only by the explicit local demo reset.
-- These accounts must never be created in a hosted Supabase project.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  phone,
  phone_confirmed_at,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'student@n5.test',
    '+15550000001',
    now(),
    crypt('N5learn26', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Student","target_level":"N5","ui_language":"en","phone_number":"+15550000001"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'admin@n5.test',
    '+15550000002',
    now(),
    crypt('N5admin26', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Administrator","target_level":"N5","ui_language":"en","phone_number":"+15550000002"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'reviewer@n5.test',
    '+15550000005',
    now(),
    crypt('N5review26', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Reviewer","target_level":"N5","ui_language":"en","phone_number":"+15550000005"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update set
  encrypted_password = excluded.encrypted_password,
  phone = excluded.phone,
  phone_confirmed_at = excluded.phone_confirmed_at,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '{"sub":"30000000-0000-4000-8000-000000000001","email":"student@n5.test","email_verified":true,"phone_verified":true}'::jsonb,
    'email',
    'student@n5.test',
    now(),
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    '{"sub":"30000000-0000-4000-8000-000000000002","email":"admin@n5.test","email_verified":true,"phone_verified":true}'::jsonb,
    'email',
    'admin@n5.test',
    now(),
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000003',
    '{"sub":"30000000-0000-4000-8000-000000000003","email":"reviewer@n5.test","email_verified":true,"phone_verified":true}'::jsonb,
    'email',
    'reviewer@n5.test',
    now(),
    now(),
    now()
  )
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (user_id, display_name, target_level, explanation_language, ui_language)
values
  ('30000000-0000-4000-8000-000000000001', 'Demo Student', 'N5', 'en', 'en'),
  ('30000000-0000-4000-8000-000000000002', 'Demo Administrator', 'N5', 'en', 'en'),
  ('30000000-0000-4000-8000-000000000003', 'Demo Reviewer', 'N5', 'en', 'en')
on conflict (user_id) do update set
  display_name = excluded.display_name,
  target_level = excluded.target_level,
  explanation_language = excluded.explanation_language,
  ui_language = excluded.ui_language,
  updated_at = now();

insert into public.user_roles (user_id, role)
values
  ('30000000-0000-4000-8000-000000000001', 'student'),
  ('30000000-0000-4000-8000-000000000002', 'student'),
  ('30000000-0000-4000-8000-000000000002', 'admin'),
  ('30000000-0000-4000-8000-000000000003', 'student'),
  ('30000000-0000-4000-8000-000000000003', 'reviewer')
on conflict (user_id, role) do nothing;

-- Enable a complete fake checkout only in this local seed. These numbers are not payment details.
update public.plans
set name = case code
      when 'premium_30d' then 'Demo Monthly'
      when 'premium_90d' then 'Demo Quarterly'
      when 'premium_365d' then 'Demo Annual'
      else name end,
    name_bn = case code
      when 'premium_30d' then 'ডেমো মাসিক'
      when 'premium_90d' then 'ডেমো ত্রৈমাসিক'
      when 'premium_365d' then 'ডেমো বার্ষিক'
      else name_bn end,
    price = case code when 'premium_30d' then 10 when 'premium_90d' then 25 when 'premium_365d' then 50 else price end,
    currency = 'BDT',
    features = jsonb_build_object(
      'published_full_mocks', true,
      'full_practice', true,
      'detailed_results', true,
      'premium_explanations', true,
      'full_mistake_notebook', true,
      'targeted_practice', true,
      'priority_support', true,
      'demo_only', true
    ),
    is_active = true,
    updated_at = now()
where code in ('premium_30d', 'premium_90d', 'premium_365d');

update public.manual_payment_settings
set is_enabled = true,
    recipient_display_name = 'JLPT Practice Local Demo',
    recipient_number = '00000000000',
    recipient_account_type = 'Local sandbox only — do not send money',
    instructions_en = 'LOCAL TEST ONLY. No real payment is accepted. Use the fill-sample button and fake transaction IDs to exercise admin review.',
    instructions_bn = 'শুধু স্থানীয় পরীক্ষা। কোনো আসল পেমেন্ট গ্রহণ করা হয় না। নমুনা তথ্য পূরণ করে অ্যাডমিন পর্যালোচনার ধাপ পরীক্ষা করুন।',
    reference_required = false,
    support_contact = 'demo@example.test',
    updated_by = '30000000-0000-4000-8000-000000000002',
    updated_at = now()
where id = 1;

insert into public.questions (
  id, content_key, revision, level, test_section_code, score_category_code,
  item_type_code, difficulty_estimate, prompt, options, status, authored_by, rights_notes
)
values
  ('40000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 1, 'N5', 'vocabulary', 'language-knowledge-reading', 'kanji_reading', 1,
   '[{"type":"text","text":"「水」は何と読みますか。"}]'::jsonb,
   '[{"id":"A","content":[{"type":"text","text":"みず"}]},{"id":"B","content":[{"type":"text","text":"みせ"}]},{"id":"C","content":[{"type":"text","text":"みち"}]},{"id":"D","content":[{"type":"text","text":"みみ"}]}]'::jsonb,
   'eligible_for_exam', '30000000-0000-4000-8000-000000000002', 'Original local demo question.'),
  ('40000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', 1, 'N5', 'vocabulary', 'language-knowledge-reading', 'orthography', 1,
   '[{"type":"text","text":"「がっこう」はどの漢字ですか。"}]'::jsonb,
   '[{"id":"A","content":[{"type":"text","text":"会社"}]},{"id":"B","content":[{"type":"text","text":"学校"}]},{"id":"C","content":[{"type":"text","text":"学生"}]},{"id":"D","content":[{"type":"text","text":"先生"}]}]'::jsonb,
   'eligible_for_exam', '30000000-0000-4000-8000-000000000002', 'Original local demo question.'),
  ('40000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000003', 1, 'N5', 'grammar-reading', 'language-knowledge-reading', 'sentential_grammar_form', 1,
   '[{"type":"text","text":"まいにち、日本語を ____。"}]'::jsonb,
   '[{"id":"A","content":[{"type":"text","text":"勉強します"}]},{"id":"B","content":[{"type":"text","text":"勉強でした"}]},{"id":"C","content":[{"type":"text","text":"勉強するです"}]},{"id":"D","content":[{"type":"text","text":"勉強しませんでした"}]}]'::jsonb,
   'eligible_for_exam', '30000000-0000-4000-8000-000000000002', 'Original local demo question.'),
  ('40000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000004', 1, 'N5', 'grammar-reading', 'language-knowledge-reading', 'sentence_composition', 1,
   '[{"type":"text","text":"日曜日に友だち ____ 映画を見ました。"}]'::jsonb,
   '[{"id":"A","content":[{"type":"text","text":"を"}]},{"id":"B","content":[{"type":"text","text":"と"}]},{"id":"C","content":[{"type":"text","text":"が"}]},{"id":"D","content":[{"type":"text","text":"で"}]}]'::jsonb,
   'eligible_for_exam', '30000000-0000-4000-8000-000000000002', 'Original local demo question.'),
  ('40000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000005', 1, 'N5', 'grammar-reading', 'language-knowledge-reading', 'text_grammar', 2,
   '[{"type":"text","text":"田中さんは午後三時に駅へ来ます。田中さんは何時に来ますか。"}]'::jsonb,
   '[{"id":"A","content":[{"type":"text","text":"午後二時"}]},{"id":"B","content":[{"type":"text","text":"午後三時"}]},{"id":"C","content":[{"type":"text","text":"午後四時"}]},{"id":"D","content":[{"type":"text","text":"午前三時"}]}]'::jsonb,
   'eligible_for_exam', '30000000-0000-4000-8000-000000000002', 'Original local demo question.'),
  ('40000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000006', 1, 'N5', 'listening', 'listening', 'quick_response', 1,
   '[{"type":"text","text":"Listening demo transcript: 「何時に来ますか。」「三時ごろです。」話し手は何時ごろ来ますか。"}]'::jsonb,
   '[{"id":"A","content":[{"type":"text","text":"二時ごろ"}]},{"id":"B","content":[{"type":"text","text":"三時ごろ"}]},{"id":"C","content":[{"type":"text","text":"四時ごろ"}]},{"id":"D","content":[{"type":"text","text":"五時ごろ"}]}]'::jsonb,
   'eligible_for_exam', '30000000-0000-4000-8000-000000000002', 'Original transcript-only local demo item; replace with reviewed audio before publication.'),
  ('40000000-0000-4000-8000-000000000007', '41000000-0000-4000-8000-000000000007', 1, 'N5', 'vocabulary', 'language-knowledge-reading', 'paraphrases', 1,
   '[{"type":"text","text":"Draft authoring example: 「大きい」の反対の意味はどれですか。"}]'::jsonb,
   '[{"id":"A","content":[{"type":"text","text":"小さい"}]},{"id":"B","content":[{"type":"text","text":"長い"}]},{"id":"C","content":[{"type":"text","text":"高い"}]},{"id":"D","content":[{"type":"text","text":"早い"}]}]'::jsonb,
   'draft', '30000000-0000-4000-8000-000000000002', 'Original local authoring example; not eligible for exams.')
on conflict (id) do update set prompt = excluded.prompt, options = excluded.options, status = excluded.status;

insert into public.question_answer_keys (question_id, correct_option_id, explanation)
values
  ('40000000-0000-4000-8000-000000000001', 'A', '{"correctAnswer":"水 is read みず (mizu), meaning water."}'::jsonb),
  ('40000000-0000-4000-8000-000000000002', 'B', '{"correctAnswer":"学校 is the standard spelling for がっこう (school)."}'::jsonb),
  ('40000000-0000-4000-8000-000000000003', 'A', '{"correctAnswer":"The polite present form of 勉強する is 勉強します."}'::jsonb),
  ('40000000-0000-4000-8000-000000000004', 'B', '{"correctAnswer":"と marks the person you do an activity with."}'::jsonb),
  ('40000000-0000-4000-8000-000000000005', 'B', '{"correctAnswer":"The passage says 田中さん arrives at three in the afternoon."}'::jsonb),
  ('40000000-0000-4000-8000-000000000006', 'B', '{"correctAnswer":"The sample exchange says 三時ごろ (around three)."}'::jsonb),
  ('40000000-0000-4000-8000-000000000007', 'A', '{"correctAnswer":"小さい is the opposite of 大きい."}'::jsonb)
on conflict (question_id) do update set correct_option_id = excluded.correct_option_id, explanation = excluded.explanation;

insert into public.tags (id, slug, label, tag_type)
values ('42000000-0000-4000-8000-000000000001', 'n5-foundations', 'N5 Foundations', 'skill')
on conflict (slug) do update set label = excluded.label, tag_type = excluded.tag_type;

insert into public.question_tags (question_id, tag_id)
select q.id, '42000000-0000-4000-8000-000000000001'
from public.questions q
where q.id in (
  '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000005'
)
on conflict do nothing;

insert into public.exam_blueprints (id, level, version, status, created_by)
values ('43000000-0000-4000-8000-000000000001', 'N5', 1, 'draft', '30000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.blueprint_slots (blueprint_id, slot_order, test_section_code, score_category_code, item_type_code, question_quota, section_duration_seconds)
values
  ('43000000-0000-4000-8000-000000000001', 1, 'vocabulary', 'language-knowledge-reading', 'kanji_reading', 1, 300),
  ('43000000-0000-4000-8000-000000000001', 2, 'vocabulary', 'language-knowledge-reading', 'orthography', 1, 300),
  ('43000000-0000-4000-8000-000000000001', 3, 'grammar-reading', 'language-knowledge-reading', 'sentential_grammar_form', 1, 300),
  ('43000000-0000-4000-8000-000000000001', 4, 'grammar-reading', 'language-knowledge-reading', 'sentence_composition', 1, 300),
  ('43000000-0000-4000-8000-000000000001', 5, 'grammar-reading', 'language-knowledge-reading', 'text_grammar', 1, 300),
  ('43000000-0000-4000-8000-000000000001', 6, 'listening', 'listening', 'quick_response', 1, 300)
on conflict (blueprint_id, slot_order) do nothing;

update public.exam_blueprints
set status = 'approved'
where id = '43000000-0000-4000-8000-000000000001';

insert into public.exam_forms (id, blueprint_id, level, form_code, version, status, manifest, is_frozen, published_at, created_by, access_tier)
values ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'N5', 'DEMO-N5-001', 1, 'draft',
  '{"local_demo":true,"label":"Local six-question sample"}'::jsonb, false, null, '30000000-0000-4000-8000-000000000002', 'premium')
on conflict (id) do nothing;

insert into public.exam_form_items (id, exam_form_id, question_id, position)
values
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 2),
  ('45000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 3),
  ('45000000-0000-4000-8000-000000000004', '44000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 4),
  ('45000000-0000-4000-8000-000000000005', '44000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', 5),
  ('45000000-0000-4000-8000-000000000006', '44000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', 6)
on conflict (exam_form_id, question_id) do nothing;

update public.exam_forms
set status = 'published', is_frozen = true, published_at = now()
where id = '44000000-0000-4000-8000-000000000001';

-- A completed sample attempt populates progress, review, bookmarks and mistake workflows.
insert into public.exam_attempts (id, user_id, exam_form_id, level, status, attempt_number, started_at, deadline_at, submitted_at)
values ('47000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', 'N5', 'submitted', 1,
  now() - interval '1 hour', now() - interval '45 minutes', now() - interval '45 minutes')
on conflict (id) do nothing;

insert into public.attempt_sections (attempt_id, section_code, section_order, status, duration_seconds, started_at, deadline_at, completed_at)
values
  ('47000000-0000-4000-8000-000000000001', 'vocabulary', 1, 'completed', 300, now() - interval '1 hour', now() - interval '55 minutes', now() - interval '55 minutes'),
  ('47000000-0000-4000-8000-000000000001', 'grammar-reading', 2, 'completed', 300, now() - interval '55 minutes', now() - interval '50 minutes', now() - interval '50 minutes'),
  ('47000000-0000-4000-8000-000000000001', 'listening', 3, 'completed', 300, now() - interval '50 minutes', now() - interval '45 minutes', now() - interval '45 minutes')
on conflict (attempt_id, section_code) do nothing;

insert into public.attempt_answers (id, attempt_id, question_id, exam_form_item_id, selected_option_id, time_spent_seconds, graded_correct)
values
  ('49000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 'A', 25, true),
  ('49000000-0000-4000-8000-000000000002', '47000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-000000000002', 'A', 34, false),
  ('49000000-0000-4000-8000-000000000003', '47000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', '45000000-0000-4000-8000-000000000003', 'A', 47, true),
  ('49000000-0000-4000-8000-000000000004', '47000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', '45000000-0000-4000-8000-000000000004', 'B', 52, true),
  ('49000000-0000-4000-8000-000000000005', '47000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', '45000000-0000-4000-8000-000000000005', 'A', 60, false),
  ('49000000-0000-4000-8000-000000000006', '47000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', '45000000-0000-4000-8000-000000000006', null, null, null)
on conflict (attempt_id, question_id) do nothing;

insert into public.exam_results (id, attempt_id, raw_correct, raw_incorrect, raw_unanswered, section_breakdown, score_category_breakdown)
values ('48000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000001', 3, 2, 1,
  '{"vocabulary":{"correct":1,"incorrect":1,"unanswered":0},"grammar-reading":{"correct":2,"incorrect":1,"unanswered":0},"listening":{"correct":0,"incorrect":0,"unanswered":1}}'::jsonb,
  '{"language-knowledge-reading":{"correct":3,"incorrect":2,"unanswered":0},"listening":{"correct":0,"incorrect":0,"unanswered":1}}'::jsonb)
on conflict (attempt_id) do nothing;

insert into public.user_bookmarks (user_id, question_id)
values ('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.user_entitlements (user_id, plan_id, status, starts_at, ends_at, source_payment_submission_id)
select '30000000-0000-4000-8000-000000000001', p.id, 'active', now() - interval '1 day', now() + interval '29 days', null
from public.plans p where p.code = 'premium_30d'
on conflict do nothing;

insert into public.payment_submissions (
  id, user_id, plan_id, provider, payment_method, amount, currency, transaction_reference,
  sender_identifier, status, reviewed_by, reviewed_at, review_note, expected_amount_snapshot,
  sender_name, reference_number, payment_at, idempotency_key, plan_snapshot, terms_confirmed_at,
  submitted_at, created_at, updated_at
)
select '46000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', p.id, 'bkash', 'send_money', p.price, p.currency,
  'LOCAL-DEMO-PAID-0001', '00000000000', 'verified', '30000000-0000-4000-8000-000000000002', now() - interval '1 day',
  'Local demo seed — no real payment was made.', p.price, 'Demo Student', 'LOCAL-DEMO', now() - interval '1 day',
  '46100000-0000-4000-8000-000000000001',
  jsonb_build_object('code', p.code, 'name', p.name, 'name_bn', p.name_bn, 'duration_days', p.duration_days, 'price', p.price, 'currency', p.currency, 'features', p.features),
  now() - interval '1 day', now() - interval '1 day', now() - interval '1 day', now()
from public.plans p where p.code = 'premium_30d'
on conflict (id) do nothing;

update public.user_entitlements
set source_payment_submission_id = '46000000-0000-4000-8000-000000000001'
where user_id = '30000000-0000-4000-8000-000000000001'
  and plan_id = (select id from public.plans where code = 'premium_30d')
  and source_payment_submission_id is null;

insert into public.payment_audit_events (payment_submission_id, actor_user_id, action, after_state)
values ('46000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'payment_request.approve', '{"status":"verified","demo":true}'::jsonb);

insert into public.announcements (id, title_en, title_bn, body_en, body_bn, href, status, created_by, published_by, published_at)
values ('53000000-0000-4000-8000-000000000001', 'Welcome to the local JLPT demo', 'স্থানীয় JLPT ডেমোতে স্বাগতম',
  'This local sandbox contains sample N5 content, mock access, and a fake payment review flow. No real payment is processed.',
  'এই স্থানীয় স্যান্ডবক্সে N5 নমুনা কনটেন্ট, মক প্রবেশাধিকার ও নকল পেমেন্ট পর্যালোচনা আছে। কোনো আসল পেমেন্ট হয় না।',
  '/dashboard', 'published', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', now())
on conflict (id) do nothing;

insert into public.notifications (id, user_id, notification_type, title, body, href, title_bn, body_bn, source_announcement_id)
values ('54000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'service_announcement',
  'Welcome to the local JLPT demo', 'Your sample account is ready. Open the exam library or payment sandbox to test the full learner flow.', '/dashboard',
  'স্থানীয় JLPT ডেমোতে স্বাগতম', 'আপনার নমুনা অ্যাকাউন্ট প্রস্তুত। পরীক্ষার তালিকা বা পেমেন্ট স্যান্ডবক্স খুলে শিক্ষার্থীর প্রবাহ পরীক্ষা করুন।', '53000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.support_tickets (id, user_id, category, subject, status, last_message_at, created_at, updated_at)
values ('51000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'payment', 'Local demo payment question', 'open', now(), now() - interval '2 hours', now())
on conflict (id) do nothing;

insert into public.support_messages (id, ticket_id, sender_user_id, sender_side, body, is_internal, created_at)
values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'student', 'I am testing the local payment flow. No real money was sent.', false, now() - interval '2 hours'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'staff', 'This is a seeded local reply. You can send a new reply and change the ticket status.', false, now() - interval '1 hour')
on conflict (id) do nothing;

insert into public.support_audit_events (ticket_id, actor_user_id, action, details, created_at)
values ('51000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'staff_reply', '{"demo":true}'::jsonb, now() - interval '1 hour');
