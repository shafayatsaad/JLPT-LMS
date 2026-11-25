# Content import guide

## Supported workflow

Open **Admin → Content → Import and author**. Upload one of:

- JSON question manifest (single question or a `questions` array).
- CSV with a header row and one question per row.
- Excel `.xlsx` with the header in row 1 and questions on the first worksheet.
- ZIP containing exactly one JSON/CSV/XLSX data file and referenced images/audio.
- A folder containing a manifest and its referenced media.

The importer previews the parsed items before import. It validates level, section/type fields, option IDs, answer-key mapping, tags, provenance, asset purpose and local file references. Import creates draft revisions, stores media in the private question-asset bucket, then submits questions and media to their separate review queues. It never publishes content.

## CSV and XLSX columns

Use these headers; column names are case-insensitive. Nested fields are JSON strings:

| Column | Required | Example |
|---|---:|---|
| `content_key` | no | UUID; a new UUID is generated if omitted or invalid |
| `revision` | no | `1` |
| `level` | yes | `N5` |
| `test_section_code` | yes | `vocabulary` |
| `score_category_code` | yes | `language-knowledge-reading` |
| `item_type_code` | yes | `kanji-reading` |
| `difficulty_estimate` | no | integer 1–5 |
| `prompt_json` | yes | `[ {"type":"text","text":"…"} ]` |
| `options_json` | yes | `[ {"id":"A","content":[…]}, … ]` |
| `tags_json` | yes | `["vocabulary","kanji-reading"]` |
| `correct_option_id` | yes | `A` |
| `explanation_json` | yes | `{"en":"…","ja":"…"}` |
| `distractor_rationales_json` | no | `{}` |
| `assets_json` | no | `[ {"file":"audio/q1.mp3","purpose":"question_audio"} ]` |
| `source_type` | no | `original`, `licensed`, `public_domain`, or `permission_granted` |
| `source_reference` | no | source packet or licensed work reference |
| `rights_notes` | no | rights/license record or reviewer note |

The workbook uses only its first sheet. For assets, use a ZIP or folder package so every `assets_json[].file` resolves to a supplied file. CSV/XLSX alone cannot attach an external local file.

## Package layout

```text
N5-form/
  manifest.json
  images/question-01.png
  audio/listening-01.mp3
```

The asset paths in the manifest are relative to that folder/package. Example purposes are `question_audio`, `question_image`, `stimulus_audio`, and `stimulus_image`.

## Safety and limits

- Up to 100 questions per batch.
- JSON/CSV/XLSX data file: up to 10 MB.
- ZIP archive: up to 150 MB; extracted content: up to 250 MB; up to 200 media files.
- Each media file: up to 50 MB. Supported image/audio types include JPEG, PNG, WebP, MP3, M4A/MP4, AAC, OGG, WAV and WebM.
- ZIP absolute paths, parent traversal, symlinks, unsupported file types, and PDFs are rejected.
- PDFs are private reference material. This import does not OCR, infer questions, infer answer keys, or publish copied papers.

## Review and publication

1. Confirm source, license/permission and rights notes.
2. Verify every prompt, option, correct answer, explanation and distractor rationale.
3. Preview each image/audio association and confirm recording duration/codec.
4. Submit question and asset review independently; an author cannot approve their own work.
5. Assemble only approved questions in a blueprint-compliant form.
6. Validate quotas and answer-sheet mapping, preview with the student renderer, and have a second reviewer publish the frozen form.

The supplied past-paper PDFs and audio remain private reference packets until redistribution/adaptation rights are documented. Do not place them in public question assets.
