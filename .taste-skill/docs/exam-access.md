# Exam attempt and access rules

Migration `202611220006_exam_attempt_lifecycle.sql` adds the authenticated attempt backend for forms that are already published and frozen.

## Form access configuration

- Every form defaults to `access_tier = 'premium'`.
- A reviewed introductory form can be marked `free` while it is still an editable draft. The published/frozen form is immutable, so set access tier before publication.
- Premium access requires a current `user_entitlements` row whose plan has `features.published_full_mocks = true`.
- Do not create active plan/entitlement rows until prices, payment review, and owner approval are complete.

The admin form assembly screen provides a free/premium selector before the draft is created. Premium is selected by default; only an administrator sees the free option. The guarded `create_exam_form_draft` function checks that role again, and publication freezes the chosen access tier. The proposed tier is a staging/demo configuration until the owner approves the final access matrix.

## Attempt lifecycle

1. `start_exam_attempt` checks authentication, published/frozen state, access, same-level approved blueprint, exact blueprint question quotas, answer-key validity, required media and consistent section timing; it creates one active attempt per learner and returns an existing attempt for an idempotent retry.
2. Each section is timed from a server timestamp. The client cannot change deadlines or section order.
3. `get_exam_attempt_payload` returns only snapshot prompts, options, saved selections, status and active-section details. It does not return answer keys or explanations.
4. `save_exam_answer` and `set_exam_answer_flag` validate ownership, active section, deadline, form item and answer option before writing.
5. Expired sections are advanced using their original server deadlines, including after reconnect. Only the active section can accept answers.
6. Submission closes the attempt, grades once, records raw counts and section/category breakdowns, and updates mistake statistics in one database transaction.
7. The existing `get_attempt_review` operation returns answer keys only to the attempt owner after the attempt is submitted or expired.

Private audio/image assets are signed through Supabase Storage only when they belong to the learner’s active section or a completed attempt. The two-hour URL lifetime covers the longest official single section with playback buffer. A published form still requires reviewed content, correct section durations, approved media and a valid answer key for every question before it can be taken.
