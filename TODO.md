# TODO

Ordered by priority.

## 1. Security: cron endpoint must fail closed

- `src/app/api/cron/notify/route.ts` skips the auth check entirely when `CRON_SECRET` is unset — an admin-privileged (service-role) endpoint that enumerates scheduled users and sends push/email is then fully open.
- Return 401 (or 500) when the secret is missing instead of proceeding unauthenticated.

## 2. Mock exam mode (סימולציית מבחן תיאוריה)

- The real Israeli theory test is 30 random questions across topics, timed, pass ≥ 26. Today only per-topic practice in fixed order exists (`public/js/quiz.js` has no timer or shuffle; `api/quiz` scores single answers).
- New route (e.g. `/[locale]/exam`): random cross-topic draw of 30 questions, countdown timer, pass/fail results screen.
- Keep a history of exam attempts so users can see their trajectory.

## 3. Finish the PWA: web app manifest + offline support

- `src/proxy.ts` already whitelists `/manifest.json`, but the file doesn't exist — the app isn't installable. Add `src/app/manifest.ts` (icons already exist: `public/favicon-512.png`, `public/icons/icon-192.png`).
- `public/sw.js` handles only `push`/`notificationclick` — no `install`/`fetch`/cache, so nothing works offline. Cache the app shell and sign images so flashcards and practice work offline.

## 4. Exam-readiness score & weakest-areas analytics

- Stats today are only `streak_days` + `star_points` (`src/lib/db.ts`). No aggregate accuracy, no "how ready am I?" signal.
- Add per-topic accuracy, a readiness indicator on the home page (projected pass probability once mock exam exists), and a "weakest topics" surface linking straight to practice.

## 5. Harden API routes

- `await request.json()` is unguarded in quiz/progress/schedule/push/send-otp routes — a malformed body throws an unhandled 500 instead of a clean 400.
- `schedule/route.ts` PUT is delete-then-insert, not transactional — a failed insert wipes the user's schedule. Move to a Supabase RPC/transaction.
- progress/topics/quiz routes swallow Supabase errors and return 200 on failed writes — check `error` and respond accordingly.
- Rate limiting (`src/lib/rate-limit.ts` exists) is missing on the progress/schedule/push mutations.

## 6. Localize API responses & notifications into Arabic

- All API error strings ("לא מחוברת", "חסרים פרמטרים"…) and the entire cron push/email digest (`cron/notify/route.ts`) are Hebrew-only, violating the rule that every user-visible string exists in both `messages/he.json` and `messages/ar.json`.
- Thread the user's locale into API routes and notifications; also fix the hardcoded `תמרור ${n}` fallback in `flashcards/page.tsx`.

## 7. Fix duplicate root layout / nested `<html>`

- Both `src/app/layout.tsx` and `src/app/[locale]/layout.tsx` render full `<html>`/`<body>` trees — every locale page produces invalid nested `<html>`, and the root layout forces `lang="he"` + stale Hebrew metadata onto Arabic pages.
- Consolidate to a single layout; tidy the shadow non-locale route dirs under `src/app/` that now hold only load-bearing `page.module.css` files.

## 8. Accessibility fixes on the quiz flow

- Icon-only links use raw glyphs with no accessible name: `✕` in `topics/[slug]/page.tsx`, `→`/`←` in schedule/flashcards. Add `aria-label`.
- Question images render `alt=""` even when the image *is* the question content (road scenes) — hidden from screen-reader users.
- Quiz option correct/wrong state is class-only, invisible to assistive tech — add `aria-pressed`/live announcements.
- `data-selected` day/duration buttons in `schedule/page.tsx` lack `aria-pressed`.

## 9. Test the untested `public/js/` layer

- Vitest coverage (90% thresholds) only measures `src/**`; the real interactive behavior in `public/js/schedule.js` (139 lines), `flashcard.js` (85), `push.js` (53), `more.js` (33), and `public/sw.js` has zero tests.
- Follow the existing DOM-fixture pattern from `quiz-script.test.ts` / `auth-script.test.ts`.

## 10. Performance: flashcards & images

- `flashcards/page.tsx` mounts all 277 sign cards (2 images each) up front with `display:none` — add pagination/windowing.
- `SignImage` uses `next/image` with `unoptimized`, and quiz/review/home/videos use raw `<img>` — enable real image optimization (add `images` config in `next.config.ts` as needed).

## Later

- Spaced repetition for flashcards/mistakes (no SRS scheduling exists today)
- Bookmark/flag questions
- Move the hardcoded videos/resources lists into the DB
- Clean up one-off scripts (`fix_q536.ts`, `fix_untranslated.ts`, …), add a Python deps manifest for `scripts/*.py`, resolve the duplicate `002_` migration prefix
