# TODO

Pre-planned 2026-07-17. Each item lists root cause, exact files, and approach so an execution workspace can start with zero re-discovery. Suggested execution order at the bottom.

Architecture facts every item relies on:

- All pages are async server components; styling is CSS Modules + design-system tokens (no Tailwind). Interactivity is vanilla JS in `public/js/*` reading translations from `window.__t` / `window.__tf` / `window.__locale`, injected by `src/app/[locale]/layout.tsx:62-98` from the `JS.*` namespaces of `messages/{he,ar}.json`.
- DB queries live in `src/lib/db.ts`; domain logic in `src/lib/{gamification,personalization,topic-card,readiness,exam}.ts`.
- Migrations: `seeds/migrations/NNN_*.sql`, highest is `015`, so next is `016` (renumber right before push; main moves fast).
- Every new UI string goes into both `messages/he.json` and `messages/ar.json`. No emoji, no em-dash (lint-enforced).

## Items

1. **Copy consistency pass** - do LAST (touches most strings; every other item adds strings).
   Target register decided: 1st-person plural "we" (נחזק, ננסה, שומרים). Files: `messages/he.json` + `messages/ar.json` (20 identical namespaces, key sets verified identical). Known offenders: `JS.Exam.examPassTitle` "עברת!", `Home.yesterdayAccuracyHigh`/`resumeLine`/`topicNotStarted` (2nd-person masc.), the mixed-register sentence `Quiz.rewardWrongPrefix` + `rewardWrongSuffix`, gerund buttons (`Quiz.restartQuizBtn`, `Exam.reviewBtn`, `Review.retryBtn`) vs `Home.startBtn`, impersonal `Schedule.summaryChoose`/`JS.Schedule.needDay`/`JS.Quiz.saveAnswerError`. Also sync the hardcoded Hebrew fallbacks in `public/js/{quiz,exam,schedule}.js` to the final he.json values (today `quiz.js:706` disagrees with `JS.Quiz.rewardTopicDone`). Mirror every change in ar.json.

2. **Replace native JavaScript dialogs with a modal component.**
   Call sites (corrected): `public/js/exam.js:186` `window.confirm` on submit; `public/js/schedule.js:98` and `:128` `alert()`. No modal exists in `src/components/`; the closest pattern is `buildMedalModal` (`public/js/quiz.js:334-389`), which violates no-inline-styles at `:363-366`. Build `public/js/modal.js` (Promise-returning confirm + alert helpers, `role="dialog"`, `aria-modal`, focus trap) styled by global CSS classes in `globals.css` (module CSS cannot reach vanilla-JS-built DOM). Make `exam.js` `submit()` await the confirm. Refactor `buildMedalModal` onto the same classes to remove the inline styles. Add confirm/cancel strings to `JS.*` in he + ar. Load via `<Script>` on exam-run and schedule pages.

3. **"Today's mission" dead-ends on a completed topic.**
   Picker is inline at `page.tsx:171-174` (first `in_progress`, else first `not_started`). Status only becomes `completed` when all answers are correct (RPC in `seeds/migrations/010:407-419`), so a 501/501-answered topic at 24% success stays `in_progress` and keeps getting picked. Fix: use/extend `selectNextTopic` (`src/lib/personalization.ts:131-148`, already documented as the intended helper) and also skip topics where `answeredMap[id] >= questionCounts[id]` (both computed at `page.tsx:167`); route fully-answered weak topics to `/topics/[slug]/retry` (or `/review`) with appropriate card copy instead of `todayTaskDesc`.

4. **Hebrew feedback rendered on the Arabic locale.**
   Root cause is NOT the `t.x || "Hebrew"` fallbacks (ar.json is complete and `window.__t` is Arabic on /ar). It is locale-unscoped persistence: storage key `"quiz-resume:v1:" + userId + ":" + topicId` (`quiz.js:41-44`) is shared across locales, and the fully rendered string is persisted (`feedbackMessage: rewardMessage.textContent`, `quiz.js:713`) then re-injected verbatim on restore (`quiz.js:783`). Fix: add `window.__locale` to the storage key AND stop persisting rendered copy - persist structured state (selected option, correctness) and re-render the message from `t` on restore. Audit exam.js/schedule.js for the same persisted-rendered-string pattern.

5. **Exam question references sign 126 but shows no image.**
   Data + heuristic bug. `seeds/questions.sql:1167`: the prompt names sign 126 but `image_url` is `/signs/sign-123.png` (the answer). The render heuristic (`topics/[slug]/page.tsx:63-66`, duplicated in `exam/run/page.tsx:63-66`) suppresses any `/signs/` image when any single option is numeric (`.some()`, not all-numeric), so nothing renders. Fix: migration `016` pointing `image_url` at the prompt's sign for this question shape (audit all sign questions with at least one numeric option naming a sign in the prompt - q369 "תמרור 303" at `questions.sql:142` has the same defect); relax the heuristic to suppress only when the image's sign number appears among the options; extract the duplicated predicate into a shared helper. Both `sign-123.png` and `sign-126.png` exist in `public/signs/`.

6. **Mistakes review renders all questions at once.**
   `review/page.tsx` is an RSC that maps all mistakes in one pass (`:260-269`, fetched via `getMistakesForTopic` at `:173`). Do server-side pagination via a `?page=N` searchParam (page size ~20) with prev/next links - stays RSC, no client JS, composes with the existing `?scope=` param. Skip virtualization.

7. **Exam result copy does not scale with the score.**
    `exam.js:163-167` picks the pass/fail title; the `/api/exam` response already carries `score`, `total`, `pass_mark`. Add tiered fail keys to `JS.Exam` (near-miss / mid / far, chosen by distance from `pass_mark`) in he + ar and select the tier in `showResults`. "לא נורא, כמעט שם." (`messages/he.json:426`, key `JS.Exam.examFailTitle`) becomes the near-miss tier only.

8. **Exam answer-review mode keeps leftover exam chrome.**
    The `reviewBtn` handler (`exam.js:255-261`) re-shows `#exam-footer` (which contains `#exam-answered`) and leaves the frozen `#exam-timer` (`exam/run/page.tsx:170-176`) visible. Fix in exam.js: entering review hides the timer and answered counter and shows a review-mode indicator plus a back-to-results affordance. Strings to `JS.Exam` (he + ar); styles in `exam/run/page.module.css` (server markup can pre-render the hidden review bar).

9. **Saving the schedule redirects to Home instead of back to More, with no confirmation.**
    `schedule.js:124-126` redirects to home after 800ms; the user arrives from More (`more/page.tsx:185`) and the page's own back button targets `/more` (`schedule/page.tsx:32`). Fix: redirect to `"/" + window.__locale + "/more"` and add a success confirmation - reuse item 2 by adding a small toast helper to `modal.js` + global CSS (no toast exists today; `--success*` tokens are already defined). Sequence after item 2.

10. **Daily goal counts distinct questions, not answers given today.**
    Confirmed: `user_quiz_responses` has `UNIQUE(user_id, question_id)`; RPC `submit_quiz_answer` (`010:240-286`) updates `answered_at = NOW()` on re-answer. Read path is `getQuizAccuracyForWindow` (`db.ts:639-661`, its own comment admits the bug) feeding `answeredToday` at `page.tsx:232`. The existing `quiz_answer_submissions` ledger is 24h-pruned and REVOKEd, so it is not a read source. Fix: migration `016` adding an append-only `quiz_answer_events(user_id, question_id, is_correct, answered_at)` written inside the RPC, plus a `db.ts` count helper over today's Jerusalem window (`dayWindow`, `personalization.ts:76`); switch the homepage daily goal to it (accuracy displays can stay distinct-question-based). Note: QA DB schema changes need a human in the Supabase SQL editor.

11. **Persist derived achievements to `user_medals`.**
    Schema is ready (`schema.sql:47-53`: open TEXT slug, UNIQUE, own-insert RLS). Today only streak medals are written (RPC `010:337-349`); the four derived achievements come from `deriveAchievements` (`gamification.ts:124-144`; the comment at `:117-122` already names this follow-up) on each More render. Fix: app-layer check-and-insert in `/api/quiz` (and `/api/exam` for exam-pass) after the RPC - compute derived achievements, insert newly earned slugs, and append them to the response's `medals_earned` so the existing celebration pipeline fires (`quiz.js:717-719` into `medalQueue` and `buildMedalModal`). Extend `MEDAL_META` (`quiz.js:324+`) and add the four slugs' strings to he + ar. The More page then reads earned dates from `user_medals` instead of recomputing (fixes all-topics un-earning).

## Execution order (minimizes cross-item conflicts)

1. Foundation: 2 (modal component), then 9 (schedule redirect + toast).
2. Independent features: 4 (locale persistence), 8 (review chrome), 7 (tiered copy), 6 (pagination), 3 (mission picker), 5 (sign-126 + migration).
3. Schema-heavy: 10 (daily goal, migration 016+), 11 (medals).
4. Copy pass (1) LAST - it rewrites strings every other item adds.

Conflict hotspots when workspaces overlap: `messages/*.json` (most items), `src/app/[locale]/page.tsx` (3), `public/js/quiz.js` (1, 4, 11), `public/js/exam.js` (2, 7, 8), migration numbering (5, 10, 11 - renumber right before push).
