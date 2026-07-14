# TODO

## 1. Localize the root 404 page

- `src/app/global-not-found.tsx` already renders the shared `NotFoundContent` via `getTranslations`, but it's hardwired to `routing.defaultLocale` (he) — Arabic users hitting a URL with no locale context get a Hebrew 404. The in-locale `src/app/[locale]/not-found.tsx` is fully localized.
- Detect the visitor's locale (cookie / `Accept-Language`) in the root boundary; any new strings go into both `messages/he.json` and `messages/ar.json` per the translation rule.

## 2. Spaced repetition for flashcards/mistakes

- No SRS scheduling exists today: `flashcards/page.tsx` + `public/js/flashcard.js` is an in-session flip deck (Yes/No buttons, zero persistence), and `user_quiz_responses` (`seeds/schema.sql`) only records `answered_at`/`session_id` — no interval, ease, or next-review columns.
- Add SRS scheduling (e.g. SM-2-style columns or a dedicated table) and feed it into both the flashcard deck and the mistakes review (`getMistakesForTopic` in `src/lib/db.ts`).

## 3. Bookmark/flag questions

- No bookmark/flag functionality or table exists anywhere in `src/` or `seeds/`.
- Needs a user↔question table, a toggle in the quiz slide markup (the question container in `topics/[slug]/page.tsx`, mirrored in the review page's `QuestionReview`), and somewhere to browse bookmarked questions.

## 4. Move the hardcoded videos/resources lists into the DB

- `videos/page.tsx` hardcodes the YouTube IDs in JSX (1 featured marathon + 1 extra + a 4-entry `lessons` array) and `resources/page.tsx` hardcodes 4 external links — the only content not in Supabase (everything else lives in `seeds/schema.sql` tables + `seeds/migrations/`).
- Add tables + a seed migration for both lists; new DB content must populate `_ar` columns per the translation rule.

## 5. Clean up one-off scripts and migration hygiene

- `scripts/fix_q536.ts` (one hardcoded question ID) and `scripts/fix_untranslated.ts` (3 hardcoded IDs) are spent one-offs; the five `scripts/*.py` files have no deps manifest (no `requirements.txt`/`pyproject.toml` in the repo); `seeds/migrations/` has two files sharing the `002_` prefix (`002_fix_correct_options.sql`, `002_fix_sign_409_correct_answer.sql`).
- Delete/archive the spent scripts, add a Python deps manifest, and renumber the duplicate migration.

## 6. Migrate `exam/route.ts` to the shared `parseJsonBody` helper

- `src/app/api/exam/route.ts` has its own inline try/catch around `request.json()` and doesn't reject non-object JSON; every other body-reading route (quiz, progress, schedule, send-otp, push/subscribe) uses `parseJsonBody` from `src/lib/api.ts`.
- Swap in the helper — smallest item on the list, can be picked up opportunistically.

## 7. Audit remaining `src/lib/db.ts` helpers that swallow Supabase errors

- Most helpers destructure only `data` and return `data ?? []` (or a default), so a failed query is indistinguishable from an empty result — the same pattern that hid the review-page mistakes bug fixed in `getMistakesForTopic`.
- Decide per helper whether to throw (like `getMistakesForTopic` now does, surfaced by `src/app/[locale]/error.tsx`) or keep the soft fallback where an empty state is genuinely acceptable.
