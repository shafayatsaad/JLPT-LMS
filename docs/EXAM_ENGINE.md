# Exam engine behavior and limits

## Current student flow

Dashboard → Mock Exams → select level/form → exam details and access check → Start Mock Exam → candidate cover → server-timed preparation → active paper section(s) → separate answer sheet → submit or deadline → result/review.

Premium forms require an active entitlement. The exam page shows the premium-required message and a link to the plan flow. Local checkout is simulated and labeled. The free N5 preview is an original five-item UI sample, not a complete JLPT section.

## Attempt lifecycle

- Attempt start, current section, server deadlines, answer writes and final scoring are managed through database RPCs. The browser cannot extend section deadlines by changing its local clock.
- Candidate name is confirmed before questions appear. Preparation lasts five server-timed minutes and survives reload.
- Active paper content is one top-to-bottom scrollable section. Answer choices map to a separate answer sheet.
- A successful answer save is confirmed from the server. Failed writes remain in the current tab's `sessionStorage` as “Not saved” and can be retried after refresh.
- Listening uses custom controls, no native seek/replay controls, and one original play plus one recovery play.
- Published form snapshots are frozen and database mutations are rejected.
- Browser Back is intercepted and opens the in-app leave confirmation. Sign-out also asks first. Refresh and tab close trigger the browser-native `beforeunload` warning; browsers control whether and how that warning is shown.

## Incomplete integrity/fidelity work

1. There is no per-form break schedule or break countdown between sections.
2. Listening assets are loaded for the active section but are not comprehensively preflighted before the student enters listening.
3. Deadlines finalize on an attempt RPC or an open-page deadline refresh. No scheduled worker closes and grades attempts while all clients are disconnected.
4. Back navigation and sign-out are guarded, and refresh/tab-close use the browser warning. Browser behavior varies, and a browser or process can still close without confirmation.
5. Fullscreen is browser-controlled and requires a user gesture. The product must use a visible optional “Enter full screen” action and graceful fallback; it must not claim fullscreen can be forced.
6. Current selected-form preview is not wired to the actual learner renderer; `/admin/exam-preview` remains a fixed N5 sample.
7. No launch-quality, rights-cleared full mock inventory exists for N1–N4. N5 local counts include synthetic QA content.

## Before launching paid exams

- Confirm section order, durations, break schedule, listening failure/recovery policy, candidate number format and finalization policy.
- Compare complete forms against rights-cleared paper references and answer sheets.
- Independently review every question, answer key, explanation, audio/script/image mapping and scoring rule.
- Test refresh, offline writes, timeout, duplicate submit, missing media, browser/device limitations and result release.
- Confirm result privacy and leaderboard opt-out behavior against product policy.
