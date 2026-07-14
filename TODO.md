# TODO

Ordered by priority.

## 1. Review page silently loses mistakes on large topics

- On the 501-question traffic-laws topic, `topics/[slug]/review` reports "no mistakes" (both scopes) even when wrong answers exist — reproduced during PR #103 verification against QA; works fine on the 106-question vehicle topic.
- Root cause: `getMistakesForTopic` (`src/lib/db.ts`) fetches all topic question IDs and passes them to a single `.in("question_id", ids)` filter on `user_quiz_responses`; with ~501 UUIDs the query appears to fail and the error is swallowed (`data` null → `[]`). Chunk the `.in()` filter (or join/filter server-side) and surface query errors instead of returning an empty list.

## 2. Test the untested `public/js/` layer

- Vitest coverage (90% thresholds) only measures `src/**`; the real interactive behavior in `public/js/schedule.js` (139 lines), `flashcard.js` (85), `push.js` (53), `more.js` (33), and `public/sw.js` has zero tests.
- Follow the existing DOM-fixture pattern from `quiz-script.test.ts` / `auth-script.test.ts`.

## 3. Performance: flashcards & images

- `flashcards/page.tsx` mounts all 277 sign cards (2 images each) up front with `display:none` — add pagination/windowing.
- `SignImage` uses `next/image` with `unoptimized`, and quiz/review/home/videos use raw `<img>` — enable real image optimization (add `images` config in `next.config.ts` as needed).

## Later

- Migrate the layout setup to Next 16's root-params / `global-not-found` conventions once they're stable (currently preview-gated; we use the documented next-intl pass-through-root-layout pattern)
- Localize the root 404 page (`src/app/not-found.tsx`) beyond the `next/error` defaults — needs he + ar strings per the translation rule
- Spaced repetition for flashcards/mistakes (no SRS scheduling exists today)
- Bookmark/flag questions
- Move the hardcoded videos/resources lists into the DB
- Clean up one-off scripts (`fix_q536.ts`, `fix_untranslated.ts`, …), add a Python deps manifest for `scripts/*.py`, resolve the duplicate `002_` migration prefix
- Migrate `exam/route.ts` to the shared `parseJsonBody` helper (it has its own inline guard)
