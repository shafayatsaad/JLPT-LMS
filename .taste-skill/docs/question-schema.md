# Question revision schema

Question content is authored and reviewed before publication. The schema validates structure; it does not establish correctness, level fit, originality, or publication approval.

## Required fields

- Stable `contentKey` plus immutable positive `revision`.
- JLPT `level`, timed `testSectionCode`, score-report `scoreCategoryCode`, and official `itemTypeCode`.
- Optional passage/dialogue group reference so related questions remain together during form assembly.
- Prompt and answer choices as typed content blocks: text, image, audio, or ruby-annotated Japanese text.
- Private correct answer and pre-authored explanation, including optional distractor rationales.
- Difficulty estimate, tags, author/reviewer records, status, and asset references.

## Answer secrecy

The authoring/import schema includes the correct answer. The exam client schema excludes the correct answer and explanations. Keep answer keys in a server-only table and reveal them only after the attempt is submitted or expired.

## Lifecycle

`draft → needs_review → approved → eligible_for_exam → retired`

Rejected revisions remain traceable and cannot enter a published exam. Once a revision is approved, change it by creating a new revision. Published exam forms reference exact revisions and a frozen manifest.

## Storage shape

The application validator is `src/features/content/question-schema.ts`. PostgreSQL stores prompt, options, and explanation as JSONB after server-side validation. Correct-answer data is split into `question_answer_keys` and never returned by exam-safe question queries.
