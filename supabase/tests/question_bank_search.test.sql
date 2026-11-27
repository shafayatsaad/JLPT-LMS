begin;

select plan(13);

insert into auth.users (id, email) values
  ('15000000-0000-4000-8000-000000000001', 'question-search-editor@example.test'),
  ('15000000-0000-4000-8000-000000000002', 'question-search-student@example.test');
insert into public.user_roles (user_id, role)
values ('15000000-0000-4000-8000-000000000001', 'content_editor');
select is((select role::text from public.user_roles where user_id = '15000000-0000-4000-8000-000000000001' and role = 'content_editor'), 'content_editor', 'fixture has its content editor role');

insert into public.questions (
  id, content_key, revision, level, test_section_code, score_category_code, item_type_code,
  prompt, options, status, authored_by, created_at, updated_at
) values
  ('65000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000011', 1, 'N5', 'vocabulary', 'reading', 'kanji-reading', '[{"type":"text","text":"phase4-qsearch-fixture 問題監査の漢字読み"}]', '[{"id":"A"},{"id":"B"}]', 'draft', '15000000-0000-4000-8000-000000000001', now() - interval '3 days', now() - interval '1 day'),
  ('65000000-0000-4000-8000-000000000002', '65000000-0000-4000-8000-000000000012', 1, 'N4', 'grammar', 'reading', 'grammar-form', '[{"type":"text","text":"phase4-qsearch-fixture 文法の問題"}]', '[{"id":"A"},{"id":"B"}]', 'needs_review', '15000000-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '2 days'),
  ('65000000-0000-4000-8000-000000000003', '65000000-0000-4000-8000-000000000013', 1, 'N5', 'listening', 'listening', 'dialogue', '[{"type":"text","text":"phase4-qsearch-fixture 会話を聞く"}]', '[{"id":"A"},{"id":"B"}]', 'approved', '15000000-0000-4000-8000-000000000001', now() - interval '1 day', now());

insert into public.tags (id, slug, label, tag_type)
values ('75000000-0000-4000-8000-000000000001', 'phase4-question-search-vocabulary', 'Phase 4 search vocabulary', 'skill');
insert into public.question_tags (question_id, tag_id)
values ('65000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000001');

set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000001","aal":"aal2"}';
set local role authenticated;
select is(auth.uid(), '15000000-0000-4000-8000-000000000001'::uuid, 'the editor identity is set for RPC checks');
select ok(private.has_any_role(array['content_editor'::public.app_role]), 'the editor role is available through the protected role helper');
select is((select total_count from public.search_question_bank(p_search => 'phase4-qsearch-fixture')), 3::bigint, 'search returns the full filtered count');
select is((select jsonb_array_length(items) from public.search_question_bank(p_search => 'phase4-qsearch-fixture', p_page => 1, p_page_size => 2)), 2, 'page one is bounded to its requested size');
select is((select items -> 0 ->> 'id' from public.search_question_bank(p_search => 'phase4-qsearch-fixture', p_page => 2, p_page_size => 2)), '65000000-0000-4000-8000-000000000001', 'page two returns the remaining row in stable order');
select is((select total_count from public.search_question_bank(p_search => '問題監査の漢字読み')), 1::bigint, 'search matches Japanese prompt text');
select is((select total_count from public.search_question_bank(p_search => 'phase4-qsearch-fixture', p_level => 'N4', p_status => 'needs_review')), 1::bigint, 'level and status filters combine');
select is((select total_count from public.search_question_bank(p_search => 'phase4-qsearch-fixture', p_section => 'listening', p_item_type => 'dialogue')), 1::bigint, 'section and item-type filters combine');
select is((select total_count from public.search_question_bank(p_skill => 'phase4-question-search-vocabulary')), 1::bigint, 'skill tags are searched from the tag relation');
select is((select items -> 0 ->> 'id' from public.search_question_bank(p_search => 'phase4-qsearch-fixture', p_sort => 'updated_desc', p_page_size => 1)), '65000000-0000-4000-8000-000000000003', 'updated-date sorting is honored');
select is((select (items -> 0) ? 'updated_at' from public.search_question_bank(p_search => 'phase4-qsearch-fixture', p_page_size => 1)), true, 'search results include the revision update timestamp');

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claims;
set local request.jwt.claim.sub = '15000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"15000000-0000-4000-8000-000000000002","aal":"aal1"}';
set local role authenticated;
select throws_ok('select * from public.search_question_bank()', 'P0001', 'Question bank access is required', 'students cannot call staff question search');

select * from finish();
rollback;
