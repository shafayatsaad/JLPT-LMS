-- Read-only staging audit. Run each SELECT separately in Supabase SQL Editor.
-- This file changes no database state and contains no application credentials.

-- 1) Check whether Supabase CLI migration history is available.
select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;

-- 2) Run only if query 1 returns supabase_migrations.schema_migrations.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- 3) Compare expected public tables and row-level security policy counts.
with expected(table_name) as (
  values
    ('profiles'), ('user_roles'),
    ('question_families'), ('questions'), ('question_answer_keys'), ('tags'), ('question_tags'),
    ('passage_groups'), ('content_group_items'), ('content_assets'), ('question_assets'), ('question_reviews'),
    ('exam_blueprints'), ('blueprint_slots'), ('exam_forms'), ('exam_form_items'),
    ('exam_attempts'), ('attempt_sections'), ('attempt_answers'), ('exam_results'), ('user_question_stats'),
    ('practice_sessions'), ('practice_session_items'), ('user_question_reviews'),
    ('plans'), ('manual_payment_settings'), ('payment_submissions'), ('user_entitlements'), ('payment_audit_events'),
    ('admin_audit_events'), ('announcements'), ('admin_exports'),
    ('notifications'), ('support_tickets'), ('support_messages'), ('support_audit_events'),
    ('user_notification_preferences'), ('user_bookmarks'), ('content_asset_reviews'), ('account_deletion_requests'), ('support_attachments')
), public_tables as (
  select c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
)
select
  e.table_name,
  p.table_name is not null as exists_in_public,
  coalesce(p.relrowsecurity, false) as rls_enabled,
  coalesce(p.relforcerowsecurity, false) as rls_forced,
  (select count(*) from pg_policies policy where policy.schemaname = 'public' and policy.tablename = e.table_name) as policy_count
from expected e
left join public_tables p using (table_name)
order by e.table_name;

-- 4) Confirm the private question-assets bucket exists.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('jlpt-question-assets', 'jlpt-payment-receipts', 'jlpt-support-attachments');

-- 5) Compare expected database functions. This checks names only, not signatures or behavior.
with expected(function_name) as (
  values
    ('advance_exam_section'), ('authorize_trusted_device_session'), ('begin_payment_receipt_upload'), ('clear_payment_receipt_upload'), ('claim_welcome_message'), ('complete_payment_receipt_upload'), ('create_admin_announcement_draft'),
    ('create_exam_blueprint_draft'), ('create_exam_form_draft'), ('create_question_draft'),
    ('create_question_drafts_batch'), ('create_support_ticket'), ('get_admin_payment_export_rows'),
    ('get_admin_user_directory'), ('get_admin_user_detail'), ('get_admin_entitlement_directory'), ('get_attempt_review'), ('get_content_asset_review_queue'),
    ('get_exam_attempt_payload'), ('get_exam_blueprint_review_queue'), ('get_my_mistake_notebook'),
    ('get_my_notification_preferences'), ('get_question_review_queue'), ('get_targeted_practice_review'),
    ('get_targeted_practice_session'), ('get_payment_checkout_options'), ('get_admin_payment_settings'),
    ('get_admin_attempt_monitor'), ('get_admin_dashboard_summary'), ('begin_support_attachment_upload'), ('complete_support_attachment_upload'), ('clear_support_attachment_upload'), ('get_support_attachment_storage_path'), ('get_question_draft_for_edit'), ('update_question_draft'), ('get_my_account_deletion_request'), ('request_account_deletion'), ('withdraw_account_deletion_request'), ('get_admin_account_deletion_requests'), ('set_admin_account_deletion_request_status'), ('get_admin_payment_plans'), ('get_admin_payment_review_queue'), ('get_admin_payment_detail'), ('get_admin_payment_receipt_path'),
    ('list_admin_announcements'), ('list_my_targeted_practice_sessions'),
    ('list_targeted_practice_tags'), ('manage_user_role'), ('mark_all_notifications_read'),
    ('mark_notification_read'), ('prevent_approved_question_mutation'), ('prevent_audit_event_mutation'),
    ('prevent_frozen_form_mutation'), ('publish_admin_announcement'), ('publish_exam_form'),
    ('register_question_asset'), ('reply_support_ticket'), ('review_content_asset'),
    ('review_exam_blueprint'), ('review_question'), ('save_admin_payment_settings'), ('save_admin_payment_plan'), ('save_exam_answer'),
    ('save_my_notification_preferences'), ('save_targeted_practice_answer'), ('set_exam_answer_flag'),
    ('set_my_mistake_reviewed'), ('set_question_draft_skill_tags'), ('set_support_ticket_status'),
    ('start_exam_attempt'), ('start_targeted_practice'), ('create_payment_request'), ('request_payment_cancellation'), ('review_payment_request'), ('register_trusted_device'), ('revoke_trusted_devices'), ('is_current_user_staff'), ('custom_access_token_hook'), ('submit_content_asset_for_review'),
    ('submit_exam_attempt'), ('submit_exam_blueprint_for_review'), ('submit_question_for_review'),
    ('submit_targeted_practice'), ('update_admin_announcement_draft'),
    ('update_exam_blueprint_draft_slots'), ('validate_exam_form')
), installed as (
  select p.proname as function_name, count(*)::integer as overload_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  group by p.proname
)
select e.function_name, coalesce(i.overload_count, 0) > 0 as installed, coalesce(i.overload_count, 0) as overload_count
from expected e
left join installed i using (function_name)
order by e.function_name;

-- 6) Migration 025 should make both private role helpers require AAL2 for staff roles.
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  position('aal2' in pg_get_functiondef(p.oid)) > 0 as requires_aal2
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in ('has_role', 'has_any_role', 'can_manage_support')
order by p.proname;

-- 8) Migration 032 private state and Auth Hook privileges. The hook must also
-- be selected/enabled in Supabase Dashboard; SQL presence alone is not enough.
select c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private'
  and c.relname in ('auth_trusted_devices', 'auth_trusted_sessions')
order by c.relname;

select
  p.proname as function_name,
  p.prosecdef as security_definer,
  has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE') as auth_admin_can_execute,
  has_table_privilege('supabase_auth_admin', 'auth.mfa_factors', 'SELECT') as auth_admin_can_read_mfa_factors
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- 7) Migration 026 receipt storage columns and private-object policies.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'payment_submissions'
  and column_name in ('receipt_storage_path', 'receipt_upload_started_at', 'receipt_uploaded_at')
order by column_name;

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'payment receipts:%'
order by policyname;
