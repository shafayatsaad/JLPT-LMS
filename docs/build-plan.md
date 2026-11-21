# JLPT practice platform build plan

## Confirmed direction

- Product kind: software. Product: an independent JLPT preparation and mock-exam platform.
- Audience: learners preparing for JLPT N1–N5.
- Main action: **Choose a JLPT level**. The level selector shows the official test-section timing and scoring-category mapping.
- Hero: use the supplied origami Sakura PNG as the real still image now. Keep the image slot replaceable by a muted, looped video when the video asset arrives.
- Copy and content: manually authored questions and explanations, with review before publication. No runtime AI or AI-generated study plans.
- Exam integrity: server-owned timers, deadlines, answer writes, grading, and answer-key release. Approved question revisions and published exam forms are frozen.
- Site system: Next.js App Router, TypeScript, Supabase PostgreSQL/Auth, accessible paper surfaces, and minimal exam screens.

## Taste Skill design plan

Kind: software (`data-type="software"`, `site-kind="software"`).

Palette: use the supplied product palette rather than the skill's generic SaaS deal. Paper `#FBFAF7`, secondary paper `#F5F1E9`, ink `#20232B`, and indigo action `#454B78`. Sakura pink stays mainly in the supplied art. Outfit is the dealt display and text face; DM Mono is reserved for timing metadata.

Hero composition: split, copy on the left and tree image on the right. The skill dealer returned `product`, `photo`, `film`, and `centred` on successive material-aware deals. Their recipes respectively require a product object, full-bleed photo, an actual video, or centered copy. None fits the brief: the tree is the supplied brand visual, the video is not ready, and the V6 build spec requires a right-side tree with left-side copy. Use the brief's split composition and record this override.

The first nav deal was `nav-cards`, which requires several different product photographs. Only one brand image is supplied, so re-deal to `nav-split` with no image panel. The random selection gave `footer-dark`, `close-type`, `surface-pairs`, `pill`, and `arc`. Keep the paper palette, `footer-dark`, `close-type`, `surface-pairs`, and `arc`; use the crisp solid button treatment required by the product spec instead of the pill button.

Voice: facts only, instructional. Use JLPT terms consistently. State platform capabilities without pass guarantees, official-score claims, customer proof, prices, or publication status that has not been supplied.

## Page plan

1. Hero — one screen. JLPT mock-exam category and N1–N5 scope; static Sakura image on the right; primary action to the level selector, secondary action to the practice interface.
2. Practice interface — one screen. The actual product UI: a question view beside a review view. Any displayed question is an original interface preview and is not a published exam item.
3. Review process — one screen. Show the test → answer review → targeted practice flow. Use the dealt `line-carries-colour` moment in this marketing section only; keep content visible without JavaScript and under reduced motion.
4. Level formats — one screen. N1–N5 selector, verified timed sections and score categories. Include the official JLPT source link.
5. Questions — one screen. Open FAQ answers; no accordion or invented testimonials.
6. Closing footer — one screen. Repeat the main action, show the independent-platform statement, and keep legal/policy links out until approved policy pages exist.

Navigation words: Practice, Review, Levels, Questions. Every link lands on a real section.

## Implementation order

1. Record the verified N1–N5 format matrix, logical data model, question schema, and content QA rubric.
2. Add the Supabase foundation migration with RLS, immutable reviewed content, frozen forms, attempts/results, payments, and audit tables.
3. Build the public experience and product-interface preview using the taste system, followed by the N5 exam vertical slice.
4. Keep unspecified plan/pricing, payment-provider, OTP, policy, and product-name values configurable until decided.

## Source checks

- Official JLPT sections and item types: <https://www.jlpt.jp/e/guideline/testsections.html>
- Official JLPT scoring sections and mappings: <https://www.jlpt.jp/e/guideline/results.html>
- Recheck these pages before launch; the JLPT notes that section times may change and listening time can vary with recording length.

## Browser review

Use the Taste Skill checker, layout checker, screenshot runner, performance checker, and finish gate against the local Next.js HTTP page. Do not serve the page through `file://`.
