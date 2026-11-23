# Question authoring template

Download [`jlpt-question-authoring-demo.json`](../public/templates/jlpt-question-authoring-demo.json) for the draft shape and an original N5 example.

Use [`mock-content-coverage-template.csv`](../public/templates/mock-content-coverage-template.csv) to track the V7.2 launch target of three forms per level across N1–N5. It is a planning checklist, not an import file; only the application's separately reviewed and published form records count as launch content.

The `/admin/questions/new` page creates question drafts manually or from an atomic JSON batch of up to 100 items. It stores separate answer keys and provenance, supports private image/audio upload, and submits question and asset records to separate reviewer queues. Import never approves content. Keep items out of forms until a different reviewer approves the content, rights and associated media.

## Field mapping

- `content_key`: stable UUID for a question family. Reuse it for a new `revision` of the same item.
- `revision`: positive integer, starting at 1.
- `level`: `N1`, `N2`, `N3`, `N4` or `N5`.
- `test_section_code`, `score_category_code`, and `item_type_code`: use codes in the active blueprint and `src/lib/jlpt-format.ts`.
- `tags`: one to eight lowercase, hyphen-separated skill slugs such as `vocabulary` or `kanji-reading`. These support curated practice and mistake filtering.
- `prompt`: JSON array of content blocks. Supported display blocks include text, ruby and line breaks.
- `options`: at least two options with stable `id` values and structured `content`.
- `answer_key`: stored separately from the learner-visible question. Never include it in public preview payloads.
- `difficulty_estimate`: optional integer from 1 to 5.
- `source_type`: `original`, `licensed`, `public_domain` or `permission_granted`. For non-original material, include a source reference and rights notes.
- `source_reference` and `rights_notes`: required for non-original content and stored with the question revision.

The included example is intentionally labeled and should not be treated as a production item. The full local workflow now covers question authoring/import, skill tagging, separate content/media review, blueprint approval, exact-quota form assembly, validation and frozen publication. It becomes usable only after the required migrations through 028 are reconciled and applied to Supabase and real human review is completed.
