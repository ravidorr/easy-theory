# TODO

## 1. Spaced repetition for flashcards/mistakes

- No SRS scheduling exists today: `flashcards/page.tsx` + `public/js/flashcard.js` is an in-session flip deck (Yes/No buttons, zero persistence), and `user_quiz_responses` (`seeds/schema.sql`) only records `answered_at`/`session_id` — no interval, ease, or next-review columns.
- Add SRS scheduling (e.g. SM-2-style columns or a dedicated table) and feed it into both the flashcard deck and the mistakes review (`getMistakesForTopic` in `src/lib/db.ts`).

## 2. Bookmark/flag questions

- No bookmark/flag functionality or table exists anywhere in `src/` or `seeds/`.
- Needs a user↔question table, a toggle in the quiz slide markup (the question container in `topics/[slug]/page.tsx`, mirrored in the review page's `QuestionReview`), and somewhere to browse bookmarked questions.

## 3. Migrate `exam/route.ts` to the shared `parseJsonBody` helper

- `src/app/api/exam/route.ts` has its own inline try/catch around `request.json()` and doesn't reject non-object JSON; every other body-reading route (quiz, progress, schedule, send-otp, push/subscribe) uses `parseJsonBody` from `src/lib/api.ts`.
- Swap in the helper — smallest item on the list, can be picked up opportunistically.

## 4. Audit remaining `src/lib/db.ts` helpers that swallow Supabase errors

- Most helpers destructure only `data` and return `data ?? []` (or a default), so a failed query is indistinguishable from an empty result — the same pattern that hid the review-page mistakes bug fixed in `getMistakesForTopic`.
- Decide per helper whether to throw (like `getMistakesForTopic` now does, surfaced by `src/app/[locale]/error.tsx`) or keep the soft fallback where an empty state is genuinely acceptable.

## 5. Bubbled `notFound()` never reaches `global-not-found` (Next 16.3.0-preview.5)

- `notFound()` thrown by the `[locale]` layout's invalid-locale guard (e.g. `/signs/nope`, where `signs` matches the `[locale]` segment) renders Next's built-in unbranded "404: This page could not be found" shell instead of `src/app/global-not-found.tsx` — verified against a production build, and identical before the 404-localization change (pre-existing).
- Since `[locale]/[...rest]` catches nearly every path, this bubbled path is how locale-less 404s actually resolve today; `global-not-found` only renders for URLs matching no route at all. Re-test after upgrading Next (experimental `globalNotFound`), or restructure so invalid locales 404 at the page level instead of the layout.
