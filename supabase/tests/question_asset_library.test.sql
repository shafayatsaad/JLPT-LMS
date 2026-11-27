begin;

select plan(13);

insert into auth.users (id, email) values
  ('15100000-0000-4000-8000-000000000001', 'phase4-asset-editor@example.test'),
  ('15100000-0000-4000-8000-000000000002', 'phase4-asset-student@example.test');
insert into public.user_roles (user_id, role)
values ('15100000-0000-4000-8000-000000000001', 'content_editor');

insert into public.questions (
  id, content_key, revision, level, test_section_code, score_category_code, item_type_code,
  prompt, options, status, authored_by
) values (
  '65100000-0000-4000-8000-000000000001', '65100000-0000-4000-8000-000000000011', 1,
  'N5', 'vocabulary', 'reading', 'kanji-reading', '[]', '[{"id":"A"},{"id":"B"}]',
  'draft', '15100000-0000-4000-8000-000000000001'
);
insert into public.questions (
  id, content_key, revision, level, test_section_code, score_category_code, item_type_code,
  prompt, options, status, authored_by
) values (
  '65100000-0000-4000-8000-000000000002', '65100000-0000-4000-8000-000000000012', 1,
  'N5', 'vocabulary', 'reading', 'kanji-reading', '[]', '[{"id":"A"},{"id":"B"}]',
  'draft', '15100000-0000-4000-8000-000000000001'
);
insert into public.content_assets (
  id, storage_path, media_type, status, uploaded_by, file_name, file_size_bytes
) values
  ('75100000-0000-4000-8000-000000000001', '15100000-0000-4000-8000-000000000001/65100000-0000-4000-8000-000000000001/audio.mp3', 'audio/mpeg', 'draft', '15100000-0000-4000-8000-000000000001', 'audio.mp3', 1024),
  ('75100000-0000-4000-8000-000000000002', '15100000-0000-4000-8000-000000000001/unused.png', 'image/png', 'approved', '15100000-0000-4000-8000-000000000001', 'unused.png', 2048);
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('jlpt-question-assets', '15100000-0000-4000-8000-000000000001/65100000-0000-4000-8000-000000000001/audio.mp3', '15100000-0000-4000-8000-000000000001', '{"mimetype":"audio/mpeg","size":1024}');
insert into public.question_assets (question_id, asset_id, purpose)
values ('65100000-0000-4000-8000-000000000001', '75100000-0000-4000-8000-000000000001', 'question_audio');

set local request.jwt.claim.sub = '15100000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"15100000-0000-4000-8000-000000000001","aal":"aal2"}';
set local role authenticated;
select is(public.update_question_asset_file_details('75100000-0000-4000-8000-000000000001', 'dialogue.mp3', 4096), true, 'uploader can update their draft file details');
select is((select file_name from public.content_assets where id = '75100000-0000-4000-8000-000000000001'), 'dialogue.mp3', 'new file name is visible in the library record');
select is((select file_size_bytes from public.content_assets where id = '75100000-0000-4000-8000-000000000001'), 4096::bigint, 'new file size is visible in the library record');
select throws_ok('select public.request_question_asset_delete(''75100000-0000-4000-8000-000000000001'')', 'P0001', 'Unlink this asset from every draft question before deleting its file', 'linked media cannot be deleted');
select is(public.unlink_question_asset('65100000-0000-4000-8000-000000000001', '75100000-0000-4000-8000-000000000001', 'question_audio'), true, 'question author can unlink media from their draft');
select is(public.link_existing_question_asset('65100000-0000-4000-8000-000000000002', '75100000-0000-4000-8000-000000000001', 'stimulus_audio'), true, 'question author can link an existing compatible file to a draft');
select is((select count(*) from public.question_assets where asset_id = '75100000-0000-4000-8000-000000000001'), 1::bigint, 'the library displays the new linked-question relationship');
select throws_ok('select public.request_question_asset_delete(''75100000-0000-4000-8000-000000000001'')', 'P0001', 'Unlink this asset from every draft question before deleting its file', 'linked media remains protected after adding a relationship');
select is(public.unlink_question_asset('65100000-0000-4000-8000-000000000002', '75100000-0000-4000-8000-000000000001', 'stimulus_audio'), true, 'the new draft relationship can be removed');
select is((select count(*) from public.question_assets where asset_id = '75100000-0000-4000-8000-000000000001'), 0::bigint, 'the audited unlink removes only the selected relationship');
select is(public.request_question_asset_delete('75100000-0000-4000-8000-000000000001'), '15100000-0000-4000-8000-000000000001/65100000-0000-4000-8000-000000000001/audio.mp3', 'unused draft returns the private storage path for deletion');
select is((select status::text from public.content_assets where id = '75100000-0000-4000-8000-000000000001'), 'retired', 'the asset record remains archived for audit history');
select throws_ok('insert into public.question_assets (question_id, asset_id, purpose) values (''65100000-0000-4000-8000-000000000001'', ''75100000-0000-4000-8000-000000000001'', ''question_audio'')', 'P0001', 'Archived media cannot be linked to a question', 'retired file cannot be reattached');

select * from finish();
rollback;
