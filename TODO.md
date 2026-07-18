# TODO

Pre-planned 2026-07-17. Each item lists root cause, exact files, and approach so an execution workspace can start with zero re-discovery. Suggested execution order at the bottom.

Architecture facts every item relies on:

- All pages are async server components; styling is CSS Modules + design-system tokens (no Tailwind). Interactivity is vanilla JS in `public/js/*` reading translations from `window.__t` / `window.__tf` / `window.__locale`, injected by `src/app/[locale]/layout.tsx:62-98` from the `JS.*` namespaces of `messages/{he,ar}.json`.
- DB queries live in `src/lib/db.ts`; domain logic in `src/lib/{gamification,personalization,topic-card,readiness,exam}.ts`.
- Migrations: `seeds/migrations/NNN_*.sql`, highest is `015`, so next is `016` (renumber right before push; main moves fast).
- Every new UI string goes into both `messages/he.json` and `messages/ar.json`. No emoji, no em-dash (lint-enforced).

## Items

1. **Hebrew feedback rendered on the Arabic locale.**
   Root cause is NOT the `t.x || "Hebrew"` fallbacks (ar.json is complete and `window.__t` is Arabic on /ar). It is locale-unscoped persistence: storage key `"quiz-resume:v1:" + userId + ":" + topicId` (`quiz.js:41-44`) is shared across locales, and the fully rendered string is persisted (`feedbackMessage: rewardMessage.textContent`, `quiz.js:713`) then re-injected verbatim on restore (`quiz.js:783`). Fix: add `window.__locale` to the storage key AND stop persisting rendered copy - persist structured state (selected option, correctness) and re-render the message from `t` on restore. Audit exam.js/schedule.js for the same persisted-rendered-string pattern.

2. **Exam question references sign 126 but shows no image.**
   Data + heuristic bug. `seeds/questions.sql:1167`: the prompt names sign 126 but `image_url` is `/signs/sign-123.png` (the answer). The render heuristic (`topics/[slug]/page.tsx:63-66`, duplicated in `exam/run/page.tsx:63-66`) suppresses any `/signs/` image when any single option is numeric (`.some()`, not all-numeric), so nothing renders. Fix: migration `016` pointing `image_url` at the prompt's sign for this question shape (audit all sign questions with at least one numeric option naming a sign in the prompt - q369 "תמרור 303" at `questions.sql:142` has the same defect); relax the heuristic to suppress only when the image's sign number appears among the options; extract the duplicated predicate into a shared helper. Both `sign-123.png` and `sign-126.png` exist in `public/signs/`.

3. **Mistakes review renders all questions at once.**
   `review/page.tsx` is an RSC that maps all mistakes in one pass (`:260-269`, fetched via `getMistakesForTopic` at `:173`). Do server-side pagination via a `?page=N` searchParam (page size ~20) with prev/next links - stays RSC, no client JS, composes with the existing `?scope=` param. Skip virtualization.

4. **Exam result copy does not scale with the score.**
    `exam.js:163-167` picks the pass/fail title; the `/api/exam` response already carries `score`, `total`, `pass_mark`. Add tiered fail keys to `JS.Exam` (near-miss / mid / far, chosen by distance from `pass_mark`) in he + ar and select the tier in `showResults`. "לא נורא, כמעט שם." (`messages/he.json:426`, key `JS.Exam.examFailTitle`) becomes the near-miss tier only.

5. **Exam answer-review mode keeps leftover exam chrome.**
    The `reviewBtn` handler (`exam.js:255-261`) re-shows `#exam-footer` (which contains `#exam-answered`) and leaves the frozen `#exam-timer` (`exam/run/page.tsx:170-176`) visible. Fix in exam.js: entering review hides the timer and answered counter and shows a review-mode indicator plus a back-to-results affordance. Strings to `JS.Exam` (he + ar); styles in `exam/run/page.module.css` (server markup can pre-render the hidden review bar).

6. **Daily goal counts distinct questions, not answers given today.**
    Confirmed: `user_quiz_responses` has `UNIQUE(user_id, question_id)`; RPC `submit_quiz_answer` (`010:240-286`) updates `answered_at = NOW()` on re-answer. Read path is `getQuizAccuracyForWindow` (`db.ts:639-661`, its own comment admits the bug) feeding `answeredToday` at `page.tsx:232`. The existing `quiz_answer_submissions` ledger is 24h-pruned and REVOKEd, so it is not a read source. Fix: migration `016` adding an append-only `quiz_answer_events(user_id, question_id, is_correct, answered_at)` written inside the RPC, plus a `db.ts` count helper over today's Jerusalem window (`dayWindow`, `personalization.ts:76`); switch the homepage daily goal to it (accuracy displays can stay distinct-question-based). Note: QA DB schema changes need a human in the Supabase SQL editor.

7. **Persist derived achievements to `user_medals`.**
    Schema is ready (`schema.sql:47-53`: open TEXT slug, UNIQUE, own-insert RLS). Today only streak medals are written (RPC `010:337-349`); the four derived achievements come from `deriveAchievements` (`gamification.ts:124-144`; the comment at `:117-122` already names this follow-up) on each More render. Fix: app-layer check-and-insert in `/api/quiz` (and `/api/exam` for exam-pass) after the RPC - compute derived achievements, insert newly earned slugs, and append them to the response's `medals_earned` so the existing celebration pipeline fires (`quiz.js:717-719` into `medalQueue` and `buildMedalModal`). Extend `MEDAL_META` (`quiz.js:324+`) and add the four slugs' strings to he + ar. The More page then reads earned dates from `user_medals` instead of recomputing (fixes all-topics un-earning).

## Execution order (minimizes cross-item conflicts)

1. Independent features: 1 (locale persistence), 5 (review chrome), 4 (tiered copy), 3 (pagination), 2 (sign-126 + migration).
2. Schema-heavy: 6 (daily goal, migration 016+), 7 (medals).

Conflict hotspots when workspaces overlap: `messages/*.json` (most items), `src/app/[locale]/page.tsx` (1), `public/js/quiz.js` (2, 8), `public/js/exam.js` (5, 6), migration numbering (3, 7, 8 - renumber right before push).
