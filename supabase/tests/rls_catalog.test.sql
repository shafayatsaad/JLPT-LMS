begin;

select no_plan();

-- Every table exposed by the platform schema audit must enforce row security.
-- The companion learner-isolation test exercises key policies through the
-- authenticated role, because catalog state alone cannot prove a policy works.
select ok(
  coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = expected.table_name and c.relkind in ('r', 'p')
  ), false),
  expected.table_name || ' has row-level security enabled'
)
from (values
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
) as expected(table_name);

select * from finish();
rollback;
