# TODO

Ordered by priority.

## 1. Localize API responses & notifications into Arabic

- All API error strings ("לא מחוברת", "חסרים פרמטרים"…) and the entire cron push/email digest (`cron/notify/route.ts`) are Hebrew-only, violating the rule that every user-visible string exists in both `messages/he.json` and `messages/ar.json`.
- Thread the user's locale into API routes and notifications; also fix the hardcoded `תמרור ${n}` fallback in `flashcards/page.tsx`.

## 2. Fix duplicate root layout / nested `<html>`

- Both `src/app/layout.tsx` and `src/app/[locale]/layout.tsx` render full `<html>`/`<body>` trees — every locale page produces invalid nested `<html>`, and the root layout forces `lang="he"` + stale Hebrew metadata onto Arabic pages.
- Consolidate to a single layout; tidy the shadow non-locale route dirs under `src/app/` that now hold only load-bearing `page.module.css` files.

## 3. Accessibility fixes on the quiz flow

- Icon-only links use raw glyphs with no accessible name: `✕` in `topics/[slug]/page.tsx`, `→`/`←` in schedule/flashcards. Add `aria-label`.
- Question images render `alt=""` even when the image *is* the question content (road scenes) — hidden from screen-reader users.
- Quiz option correct/wrong state is class-only, invisible to assistive tech — add `aria-pressed`/live announcements.
- `data-selected` day/duration buttons in `schedule/page.tsx` lack `aria-pressed`.

## 4. Test the untested `public/js/` layer

- Vitest coverage (90% thresholds) only measures `src/**`; the real interactive behavior in `public/js/schedule.js` (139 lines), `flashcard.js` (85), `push.js` (53), `more.js` (33), and `public/sw.js` has zero tests.
- Follow the existing DOM-fixture pattern from `quiz-script.test.ts` / `auth-script.test.ts`.

## 5. Performance: flashcards & images

- `flashcards/page.tsx` mounts all 277 sign cards (2 images each) up front with `display:none` — add pagination/windowing.
- `SignImage` uses `next/image` with `unoptimized`, and quiz/review/home/videos use raw `<img>` — enable real image optimization (add `images` config in `next.config.ts` as needed).

## Later

- Spaced repetition for flashcards/mistakes (no SRS scheduling exists today)
- Bookmark/flag questions
- Move the hardcoded videos/resources lists into the DB
- Clean up one-off scripts (`fix_q536.ts`, `fix_untranslated.ts`, …), add a Python deps manifest for `scripts/*.py`, resolve the duplicate `002_` migration prefix
- Migrate `exam/route.ts` to the shared `parseJsonBody` helper (it has its own inline guard)
