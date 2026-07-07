# Changelog

All notable changes to ClearRoad (דרך ברורה) are documented here.

## [Unreleased]

### Added
- Tests for `src/lib/rate-limit.ts`: 4 cases covering true/false/null RPC responses and correct parameter passing
- Tests for `src/lib/db.ts`: 22 cases covering all query helpers (null fallbacks) and `getMistakesForTopic` deduplication logic (latest-response-per-question, wrong→right and right→wrong sequences)
- Shared `SignImage` component with consistent sizing (`xs`/`sm`/`md`) used across quiz, review, flashcards, and resources pages
- Unit tests for `SignImage` (no multiply blend mode, style overrides)
- Migration `002_fix_correct_options.sql` to correct `correct_option` values misparsed from zero-padded XML `correctAnswer` IDs

### Fixed
- Sign images no longer use `mix-blend-mode: multiply`, which washed out colors on light backgrounds
- Question seed data regenerated with corrected answer keys and image URLs

---
- README badges: Vercel deployment status, MIT license, last commit, Next.js, TypeScript, Supabase, pnpm, and Vitest badges
- Vitest coverage configuration (v8 provider, text + lcov reporters, all-files mode) and `test:coverage` script
- `coverage/**` added to ESLint ignore list so generated reports are not linted
- `vitest.config.ts` and `vitest.setup.ts` excluded from `tsconfig.json` so Next.js build does not type-check dev-only Vitest configs

### Fixed
- Quiz route tests: added `rpc` to the Supabase mock in `route.test.ts` so all 7 previously-failing tests now pass (broken when `rate-limit.ts` was introduced)

---

### Added
- CSS linter (Stylelint + `stylelint-config-standard`), HTML linter (HTMLHint), and Markdown linter (markdownlint-cli2) with `lint:css`, `lint:html`, `lint:md`, and `lint:all` scripts
- All four linters (ESLint, Stylelint, HTMLHint, markdownlint) enforced in the pre-commit hook

### Fixed
- ESLint errors in `design-system/support.js`: replaced deprecated `ReactDOM.render` with `createRoot`, renamed `module` variable to avoid shadowing the global

---

### Added
- Web push notifications: service worker (`public/sw.js`), client subscription helper (`public/js/push.js`), and `POST /DELETE /api/push/subscribe` route to store subscriptions in new `user_push_subscriptions` table
- Cron now sends web push to subscribed users and falls back to email for everyone else; expired push subscriptions are automatically cleaned up
- `getPushSubscriptionsForUsers()` helper in `src/lib/db.ts`
- `user_push_subscriptions` table in schema with RLS (own rows only)
- Service worker registered globally via `src/app/layout.tsx`; VAPID public key exposed via `<meta name="vapid-public-key">`

### Fixed
- Cron notify route: move Resend client instantiation inside handler to prevent build-time failure when `RESEND_API_KEY` is not set
- Cron schedule changed from `* * * * *` to `0 5 * * *` (daily at 5 AM UTC = 7–8 AM Israel time) to comply with Vercel Hobby plan limits

### Added
- Daily morning digest email: Vercel Cron fires once per day at 5 AM UTC, queries `user_schedule` for users with a session today and `notify = true`, sends a Hebrew digest email via Resend listing the day's session time and duration
- `createAdminClient()` in `src/lib/supabase.ts` for server-side admin operations using the service role key
- `getUsersDueNow()` in `src/lib/db.ts` to find scheduled users matching current Israel day and time
- `GET /api/cron/notify` route protected by `CRON_SECRET`, dispatches emails via Resend
- `vercel.json` registering the cron job on a `* * * * *` schedule
- Medal earn celebration: quiz page now shows a modal when `POST /api/quiz` returns `medals_earned`; supports queuing multiple medals, dismiss via button or scrim tap, never auto-dismisses
- Design system: added `MedalCelebration` component (`components/gamification/`) and `medal-earned.html` reference screen
- Topic completion detection: after a correct answer, check if all questions in the topic have been answered correctly at least once; call POST /api/progress with status "completed" automatically
- Quiz route now returns `topic_completed: boolean` in its response
- `checkTopicCompletion` helper in `src/lib/topic-completion.ts` with 7 unit tests
- 8 handler-level tests for POST /api/quiz (auth guard, input validation, completion logic)
- Vitest test framework with jsdom environment and React Testing Library

### Fixed
- Progress route no longer downgrades topic status from "completed" to "in_progress"
- Quiz UI updates reward message to "כל הכבוד! סיימת את כל הנושא!" when topic is completed

## [0.1.4] — 2026-07-04

### Fixed
- README: Next.js version corrected to 16
- CONTRIBUTING: document pre-commit hook requirement (CHANGELOG + version bump per commit)

## [0.1.3] — 2026-07-04

### Changed
- Add Python `__pycache__/` and `*.pyc` entries to `.gitignore`

## [0.1.2] — 2026-07-04

### Fixed
- Quiz: hide question image for sign-identification questions (all options are sign numbers) — image was revealing the correct answer
- Quiz: allow changing answer selection freely before confirming; feedback is now shown only after clicking "בדקי תשובה"
- Quiz: instant correct/wrong feedback from embedded `data-correct` attribute — no longer blocked on API round-trip
- Quiz: remove meaningless sign number label from answer options; show sign image only
- Quiz: sign images with white backgrounds now blend cleanly against green/red feedback colors via `mix-blend-mode: multiply`
- Quiz: sign-identification questions with missing question images no longer filtered out (image is not shown anyway)

## [0.1.1] — 2026-07-04

### Added
- Pre-commit hook (husky): every commit must include a `CHANGELOG.md` update and a `package.json` version bump

### Changed
- Rebrand: primary color direction changed from lilac ("עדין ושובב", hue 300) to new-driver plate blue ("לוחית נהג חדש", hue 264)

## [0.1.0] — 2026-07-04

### Added
- **Auth** — magic-link email login (no password), session middleware, logout
- **Home** — streak pill, stars pill, today's task card with PathProgress, topic list with progress bars, TabBar
- **Topics** — topic list page; quiz session per topic with sign images in questions and answer options
- **Flashcards** — 277 sign cards with 420ms flip animation; back face shows clean sign name and ghost image
- **Schedule** — weekly day picker, time and duration inputs
- **More** — navigation hub to Schedule / Videos / Resources; dark mode toggle (cookie-persisted, no FOUC); logout
- **Videos** — featured video + topic-grouped rows with YouTube thumbnails
- **Resources** — external links: gov sign chart, official question bank, noeg.co.il, Wikipedia
- **Design system** — full token set (colors, type, spacing, radius, effects), component library, screen references
- **Assets** — 277 official sign PNGs (לות״ם September 2022)
- **Seeds** — schema SQL, 4 topics, 1,802 questions, 277 signs with names patch for 9 OCR-failed entries
- **Deployment** — Vercel (production: easy-theory-omega.vercel.app), Supabase for DB + auth, Resend for email delivery

### Fixed
- TabBar centering in RTL: replaced `insetInlineStart: 0` with `left: 50% / translateX(-50%)`
- Flashcard back face: OCR-extracted sign numbers replaced with real Hebrew names via `cleanName()`
- Dark mode: theme cookie read server-side in layout so correct theme renders with zero flash

### Changed
- `middleware.ts` renamed to `proxy.ts` per Next.js 16 convention
