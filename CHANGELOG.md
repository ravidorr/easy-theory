# Changelog

All notable changes to ClearRoad (דרך ברורה) are documented here.

## [Unreleased]

### Fixed
- Flashcard flip control is now a named `button` with `aria-expanded`, keyboard support (Enter/Space), and `aria-hidden` on the back face when collapsed
- Localized 404 pages now include the tab bar so users can navigate back without using the CTA alone
- theme-color meta now follows the active theme on first paint and when toggling light/dark mode on the More page

### Added
- Question bookmarks: a new `user_question_bookmarks` table (migration `013_question_bookmarks.sql`, composite `(user_id, question_id)` PK with own-rows RLS), an idempotent `PUT /api/bookmarks` route (auth + rate limit + UUID validation), a bookmark toggle on every quiz/retry slide and review card (server-rendered `aria-pressed` state, driven by the shared `public/js/bookmark.js` with optimistic flip, busy guard, and a polite live-region error announcement), and a `/bookmarks` browse page (correct answer + explanation per card, un-bookmark in place) linked from a new row on the More page. New `bookmark` icon in the Icon component; new `Bookmarks`/`More.navBookmarks`/`Quiz.bookmarkLabel`/`Api.bookmarkUpdateFailed`/`JS.Bookmark` keys in he + ar.
- Landing page v2 per the updated design system: trust badge ("מבוסס על המאגר הרשמי"), phone-framed real app screenshots (hero + "הצצה פנימה" gallery, captured from the QA environment into `public/landing/`), a 4-item FAQ section, an emotional-close card whose CTA anchors back to the login card, and a redesigned magic-link success card (check circle, spam hint, "שליחה מחדש" pill) that replaces the form on success. New `check` icon in the Icon component. New/updated `Login` keys in he + ar; Arabic phrasing pending professional-translator review.

### Changed
- QA runs now publish straight to GitHub instead of leaving findings in a local folder (review feedback: local-folder findings are invisible and go unactioned). `/qa-explore` pushes the validated run dir (report, findings.json, screenshots) to the `qa-evidence` branch via the new `pnpm qa:publish-evidence`, files one issue per new finding (labels: `qa` + a type label `bug`/`enhancement`/`product-question` + `a11y`/`copy` category labels where relevant) with inline screenshots, comments "still reproduces" on matching open `qa` issues instead of filing duplicates, and files + closes a `qa-run` run-report issue as the archived record. The local run dir is deleted after a successful publish (kept on partial publish); the `~/qa-runs-backup/` step is gone. `.claude/settings.json` now allows `gh issue create/comment/close`, `gh label create`, and the publish script, and still denies `gh issue edit/delete`; qa/RUNNING.md and qa/PLAN.md document the new triage-on-GitHub gate. Review fixes: the publish script deletes a leftover local `qa-evidence` branch before `checkout --orphan` so a failed first push can be retried, and the dedup query passes `--limit 200` (gh defaults to 30 and truncates silently).
- Imported the ClearRoad design-system full export (14.07.2026) verbatim into `design-system/`: gender-neutral voice docs, new kit screens (exam intro/run, review, credits, 404, landing v2), medals grid on more, readiness/weak-topics on home, favicon + official sign assets, and design-tool helpers (`image-slot.js`, `tweaks-panel.jsx`). The directory is now an exact mirror of the design tool's export (kit specimens are inline-styled by design) and is exempt from ESLint/stylelint/htmlhint-title/markdownlint; orphaned per-kit CSS files were removed. The export's `uploads/` source scans were not imported (the zip's signs-chart.pdf is truncated).
- Gender-neutral Hebrew copy pass across the app per the design-system voice change: feminine imperatives/present-tense/plurals (שלחי, בחרי, נסי, שומרת, מתחילות, ממשיכות, אלייך...) replaced with infinitives and first-person plural in `messages/he.json`, `public/js` fallback strings, and the review retry button (now "חזרה על הטעויות"); Arabic counterparts updated to neutral masdar phrasing (pending professional-translator review).

### Fixed
- ESLint warnings in maintained application code: exclude imported `design-system/` artifacts from linting, fix unused-variable warnings in `schedule.js` and the topics route test, and add schedule save-failure script tests.
- Next.js workspace-root warning during dev and build by setting `turbopack.root` to the project directory and removing an empty home-level `package-lock.json` that caused incorrect root inference.
- Quiz-flow accessibility gaps that were invisible to assistive tech:
  - Icon-only `→` back links on schedule, flashcards, and credits now carry a localized `aria-label` (new `backLabel` key in `Schedule`/`Flashcards`/`Credits`, he + ar)
  - Quiz/retry/exam option buttons expose selection via `aria-pressed` (server-rendered `false`, kept in sync by `quiz.js`/`exam.js`; the chosen option stays pressed after confirmation)
  - Correct/wrong option results — previously color-only via `data-state` — get a visually-hidden "correct/wrong answer" span (`Quiz`/`JS.Quiz` `optionCorrectSr`/`optionWrongSr`, he + ar), appended by `quiz.js`/`exam.js` and server-rendered on the review page
  - Schedule day/duration buttons mirror their `data-selected` state with `aria-pressed` (server render + `schedule.js` click handlers), matching the notify toggle's existing pattern

---

## [0.3.130] — 2026-07-14

### Added
- Branch coverage tests for the bookmarks page image-resolution logic, raising overall branch coverage from 94.68% to 96.45%: placeholder fallback for a missing `/questions/` image, wide rendering of an existing question image, sign questions hiding the question image and rendering the numeric option as a sign, square sign question images with the sign-number alt, and the ar-locale fallback to Hebrew when `question_ar` is absent.

---

## [0.3.129] — 2026-07-14

### Fixed
- Locale-less 404s (e.g. `/signs/nope`, or any junk path with a dot — everything the proxy skips past next-intl's locale normalization) now render the branded, locale-detected 404 instead of Next's built-in "This page could not be found" shell. The 0.3.117 migration to `experimental.globalNotFound` assumed `global-not-found.tsx` also catches `notFound()` bubbling up from the `[locale]` layout's invalid-locale guard; it doesn't — per the Next docs it only covers URLs matching no route at all, and `[locale]/[...rest]` matches nearly everything. Restored the boundary pattern that migration removed, keeping the 0.3.121 localization: `src/app/global-not-found.tsx` is `src/app/not-found.tsx` again (cookie/`Accept-Language` locale detection intact), a pass-through root `layout.tsx` gives it a layout above it, the experimental flag is gone, and `src/app/[locale]/layout.tsx` reads the locale from the `params` prop again (with a root layout above it, `[locale]` is no longer a root param, so `next/root-params` stops compiling). Verified against a production build: `/signs/nope` and `/foo/bar.xyz` return 404 with the branded page in Hebrew or Arabic per the visitor's locale signals; completed TODO item removed.

---

## [0.3.128] — 2026-07-14

### Changed
- `src/lib/db.ts` read helpers no longer swallow Supabase errors: every helper now throws on a failed query (with the original error as `cause`) instead of returning an empty/zero-state result — the pattern that hid the review-page mistakes bug. Pages surface these via the localized error boundary; a failed notify-cron query now returns HTTP 500 instead of silently notifying nobody; a mid-pagination failure in `getTopicAccuracy` no longer truncates results. `getTopicBySlug`, `getUserStats`, and `markTopicCompleted` switched from `.single()` to `.maybeSingle()` so the normal "no rows" case (unknown slug 404, new-user zero-state, first completion insert) keeps working. The one deliberate exception is `getBookmarkedQuestionIds`, which keeps its documented soft fallback. Throw-path tests added for every hardened helper.

---

## [0.3.127] — 2026-07-14

### Added
- Spaced repetition (binary SM-2) for flashcards and quiz mistakes: a new `user_srs_cards` table (migration `014_srs_cards.sql`, one row per (user, sign) or (user, question) with ease/interval/repetitions/due_at, own-rows RLS, hand-applied in prod + QA), a pure scheduler in `src/lib/srs.ts` (pass ladder 1d → 6d → round(interval × ease); fail resets and drops ease by 0.2 with a 1.3 floor, due immediately), and a signs-only `POST /api/srs` route (auth + 60/min rate limit + UUID validation). The flashcard deck is now ordered due-first → never-seen → not-yet-due with a "due today" count, and each Yes/No click persists a grade (fire-and-forget, first answer wins on in-session replays); question cards advance only through real quiz answers via a guarded post-RPC hook in `/api/quiz` that never fails the quiz response. `getMistakesForTopic` merges each mistake's `due_at` and sorts due-first, and the review page shows a due count plus a "לחזרה" badge on due mistakes. New `Flashcards.dueToday`, `Review.dueBadge`/`dueCount`, `Api.srsSaveFailed` keys and updated `Flashcards.footerNote` in he + ar; completed TODO item removed.

---

## [0.3.126] — 2026-07-14

### Changed
- The exam API route now parses its request body with the shared `parseJsonBody` helper from `src/lib/api.ts` like every other body-reading route, so non-object JSON payloads (numbers, strings, arrays) are rejected with a 400 at parse time instead of relying on downstream field validation; completed TODO item removed.

---

## [0.3.122] — 2026-07-14

### Changed
- Moved the videos and resources page content out of hardcoded JSX and translation keys into new Supabase `videos` and `resources` tables (migration `seeds/migrations/012_videos_resources.sql`, with Hebrew + Arabic seed rows and public-read RLS). Both pages now fetch rows via new `getVideos`/`getResources` helpers in `src/lib/db.ts` and pick `_ar` fields with `_he` fallback per locale; the moved per-item keys were removed from `messages/he.json` and `messages/ar.json` (page chrome keys remain). `pnpm qa:mint --check` probes the new tables' schema and seed counts; `qa/SETUP.md`'s migration list updated. The migration must be run manually in the Supabase SQL editor (QA + prod); completed TODO item removed.

---

## [0.3.121] — 2026-07-14

### Fixed
- The root 404 (`global-not-found.tsx`) is no longer hardwired to Hebrew: it now resolves the visitor's locale from the `NEXT_LOCALE` cookie, then `Accept-Language` (new `detectLocale` helper in `src/i18n/detect-locale.ts`, q-value aware and tolerant of RFC 9110 whitespace/case variants), then the default — so Arabic visitors on locale-less URLs get the Arabic 404. Verifying this surfaced a pre-existing gap, recorded as TODO item 5 (numbering as of 0.3.122): on Next 16.3.0-preview.5, `notFound()` bubbled from the `[locale]` layout renders Next's built-in shell instead of `global-not-found`.

---

## [0.3.120] — 2026-07-14

### Removed
- Spent one-off scripts `scripts/fix_q536.ts` and `scripts/fix_untranslated.ts` (hardcoded question IDs already fixed in the live DB; the reusable flow lives in `find_untranslated.ts`/`translate_arabic.ts`).

### Added
- `scripts/requirements.txt` manifest for the Python pipeline scripts (Pillow + numpy for `remove_sign_backgrounds.py`; the rest are stdlib-only, `extract_signs.py` also needs the external `pdftohtml` binary).

### Changed
- Renumbered `seeds/migrations/002_fix_sign_409_correct_answer.sql` to `011_...` to resolve the duplicate `002_` prefix (single-row data fix, order-independent, already applied to prod/QA); `qa/SETUP.md`'s migration list updated accordingly.

---

## [0.3.119] — 2026-07-14

### Added
- Twelve new exploratory-QA charters (`qa/charters/002`–`013`) covering the rest of the app beyond the 001 pilot: mistake review + retry, exam simulation, flashcards, schedule + reminders, More hub (stats/theme/language/logout), Arabic locale sweep, login/auth edge cases, new-user empty states, static pages + 404 handling, PWA/offline caching, desktop viewport sweep, and light-theme sweep.

### Fixed
- Misspelled review mistake-count copy in `messages/he.json`: `Review.mistakeCountOne`/`mistakeCountMany` now read "שגויה"/"שגויות" instead of "שגית" (found by the 002 charter run; Arabic strings were already correct).
- `pnpm qa:mint --check` now probes one schema object per migration (columns from 006/007/009, auth-gated RPCs from 008–010 via dummy-args calls that must raise `not_authenticated`), so a QA project with stale schema fails preflight instead of 500-ing mid-run; `qa/SETUP.md`'s seed list no longer stops at migration 005 and tells maintainers to keep the QA schema in sync.
- QA browser tooling artifacts (`.playwright-mcp/`) are gitignored.

---

## [0.3.117] — 2026-07-14

### Changed
- Migrated the layout setup to Next 16 conventions: the pass-through root `layout.tsx` (the next-intl workaround that gave the root 404 a layout above it) is gone. `src/app/not-found.tsx` is now `src/app/global-not-found.tsx` (`experimental.globalNotFound`), which handles unmatched URLs and `notFound()` bubbling to the root, and `src/app/[locale]/layout.tsx` reads the locale via `next/root-params` (`await locale()`) instead of the `params` prop. Layout/404 tests updated accordingly; completed TODO item removed.

---

## [0.3.116] — 2026-07-14

### Added
- ESLint rules banning emoji and em-dash characters in string literals (`eslint-plugin-no-emoji`, `eslint-plugin-no-em-dash`), added to the flat config as errors.
- New `gem` and `trophy` icons in the Icon component, mirrored in `design-system/icons.svg`.

### Changed
- More-page milestone medals render SVG icons (flame, star, gem, trophy) instead of emoji, with explicit earned/unearned colors; the unearned-medal date placeholder is now a plain hyphen.
- Home stepper's final step shows its number instead of a finish-flag emoji, and the streak medal nudge no longer embeds a medal emoji (`daysToMedalOne`/`daysToMedalMany` lost their `{medal}` parameter in he + ar).
- Stripped remaining emoji and replaced em-dashes with hyphens in translation JSONs (he + ar), `public/js` fallback strings, script console output, and test names.

---

## [0.3.115] — 2026-07-14

### Changed
- Flashcards page performance: the server now renders only the first card plus a JSON payload of all signs (`#fc-data`), and `flashcard.js` swaps the single card's content on advance (with image preloading and a placeholder fallback) — previously all 277 cards (~554 images) were mounted up front with `display:none`.
- Real image optimization: removed `unoptimized` from `SignImage` (SVG sources still bypass the optimizer automatically), converted all raw `<img>` tags to `next/image` (home topic icons, login feature icons, YouTube video thumbnails, wide question photos in quiz/retry/review/exam), and added an `images` config to `next.config.ts` (`i.ytimg.com` remote pattern, long `minimumCacheTTL`).

---

## [0.3.114] — 2026-07-14

### Added
- Tests for the previously untested `public/js/` scripts: `flashcard.js` (flip, know/don't-know navigation, replay queue, done state, translations), `push.js` (feature detection, VAPID key decoding, subscribe/unsubscribe API calls), and `more.js` (dark-mode switch sync, theme cookie, logout redirect); extended `schedule-script.test.ts` with day/duration pickers, notify toggle, zero-day guard, successful save + redirect, and `pushHelpers` integration.

---

## [0.3.113] — 2026-07-14

### Fixed
- Review page silently showing "no mistakes" on large topics: `getMistakesForTopic` passed all ~501 traffic-laws question IDs to a single `.in()` filter, producing an oversized request URL whose failure was swallowed into an empty result. The topic filter now runs server-side via a `questions!inner(topic_id)` join, the mistake-details fetch is chunked (100 IDs per request), and failed queries throw instead of masquerading as a clean slate.
- Added a localized error boundary (`src/app/[locale]/error.tsx`, new `Error` strings in he + ar) so surfaced query failures render a translated "something went wrong" page with retry, instead of Next's default 500.

---

## [0.3.112] — 2026-07-14

### Changed
- Expanded the seven one-line "Later" bullets in `TODO.md` into fully detailed items 4–10 (current state + suggested action, verified file paths), matching the format of items 1–3; corrected the stale note about the root 404 page, which is already localized but hardwired to the default locale.

---

## [0.3.108] - 2026-07-14

### Fixed
- Touch retry double-taps no longer advance past recovered quiz feedback, and retry outcomes remain disabled until the active touch suppression window expires.

---

## [0.3.107] - 2026-07-14

### Fixed
- Quiz answer feedback remains visible after rapid mouse double-clicks, touch double-taps, and repeated Enter key events. A later distinct pointer or keyboard activation still advances normally.

---

## [0.3.106] - 2026-07-14

### Fixed
- Quiz submission identifiers now use cryptographically secure browser randomness when `crypto.randomUUID` is unavailable.

---

## [0.3.105] - 2026-07-14

### Fixed
- Rejected quiz submissions remain on the current question and can be retried without advancing or completing the topic. Pending and acknowledged submissions survive reloads, while permanent localized API failures stop blind retries and offer a clean restart.
- Quiz answer persistence, idempotency, rewards, completion, and database-bound rate limiting now run transactionally so concurrent or repeated requests return the original result without duplicate progress or rewards.
- Correct answers earn rewards only once per user and question through an immutable, access-restricted ledger, while later answers can still update review state.
- Migration `010_quiz_submission_idempotency.sql` must be deployed before the application. It adds the transactional submission path and minute-by-minute, indexed cleanup with a shared 10,000-row ceiling.

### Notes
- The reward ledger best-effort backfills currently correct responses. Prior correct-then-wrong history is unavailable, so rare historical cases may receive one additional reward after deployment.

---

## [0.3.104] — 2026-07-14

### Added
- Branded, localized 404 page (from the designer's ClearRoad handoff), replacing the default Next.js English error screen:
  - New `NotFound` namespace in `messages/he.json` + `messages/ar.json` (Arabic strings are machine-translated pending professional translator review)
  - Shared `NotFoundContent` component: no-entry sign SVG (fixed `--sign-*` tokens), headline, support line, and a pressable `btn-primary` CTA back home; light/dark via tokens
  - `src/app/[locale]/not-found.tsx` + `[...rest]` catch-all so unmatched URLs under a valid locale render the localized 404 inside the app layout
  - Root `not-found.tsx` rebranded for locale-less/invalid-locale requests (default-locale strings, own `<html lang="he" dir="rtl">`)

---

## [0.3.103] — 2026-07-14

### Fixed
- API responses and cron notifications are now localized into Arabic (previously Hebrew-only):
  - All user-visible API error strings moved to a new `Api` namespace in `messages/he.json` + `messages/ar.json`; routes resolve the caller's locale from the `NEXT_LOCALE` cookie via new `getRequestLocale`/`getApiTranslator` helpers in `src/lib/api.ts`
  - The cron push/email digest uses the existing (previously unused) translated `Notify` namespace, per user: migration 009 adds a `locale` column to `user_schedule` (captured on schedule save through the updated `replace_user_schedule` RPC — run the migration in Supabase **before** deploying)
  - The flashcards numeric-name fallback reuses the localized `Flashcards.signBadge` label instead of a hardcoded `תמרור {n}`
  - Note: notification locale is captured when the schedule is saved; switching UI language updates it on the next schedule save

---

## [0.3.102] - 2026-07-14

### Changed
- Added a reusable seed-project `.gitignore` covering dependencies, build output, environment files, QA artifacts, and local agent tooling

---

## [0.3.101] — 2026-07-14

### Fixed
- Screen-reader accessibility across the quiz flows and home page:
  - Question sign images (quiz, retry, review, exam) now announce "תמרור {number}" — the official sign number identifies the image without revealing its meaning and spoiling the answer; non-sign question photos announce a generic "attached image" label (previously all `alt=""`, leaving "התמרור שלפניך" questions unanswerable with a screen reader)
  - Picture-based answer options announce their sign number the same way
  - Home header streak/star counters gain visually-hidden labels (new `.sr-only` utility) instead of being bare numbers
  - The quiz/retry/review close controls are now named "סגירה" via `aria-label` (previously announced as "✕"), matching the existing exam pattern
  - CTAs that nested a `<button>` inside a `<Link>` (today card, empty state, quiz/retry/review/exam final screens) are now single links styled as buttons — one tab stop, valid interactive nesting, identical visuals

---

## [0.3.100] — 2026-07-14

### Fixed
- Nested `<html>` hydration errors on every page (4 error-level console entries per navigation): the root layout is now a pass-through and `src/app/[locale]/layout.tsx` is the sole owner of `<html>`/`<head>`/`<body>` — Arabic pages no longer get the stale hardcoded `lang="he"` + Hebrew metadata, and the cookie-based `themeColor` viewport moved into the locale layout
- Added a root `src/app/not-found.tsx` (renders its own `<html>`, `next/error` defaults) for non-localized requests and invalid locales; localizing it is tracked in TODO
- Tidied the shadow non-locale route dirs under `src/app/`: all 13 load-bearing `page.module.css` files moved next to their `[locale]` pages (relative imports), the unused `topics/page.module.css` deleted, and `auth-script.test.ts` relocated with its path fixed

---

## [0.3.99] — 2026-07-14

### Added
- Topic quizzes now resume after a reload: position, score, points, and session id are saved per user + topic in `localStorage` on every advance, restored on load, and cleared on completion. Saved state is discarded if the topic's question set changed, and retry sessions never persist (QA finding: a reload restarted a 361-question session at question 1)

### Fixed
- The daily-task card no longer promises "8 שאלות תרגול · ~20 דק׳" — the linked topic quiz is a single full-topic session (361 questions for signs). The card now shows the topic's real question count and notes you can continue where you left off
- Dashboard topic cards now show real mid-practice progress (answered/total questions, computed from quiz responses) instead of staying on "טרם התחלת" until the whole topic is finished; completed topics keep showing their best score. The daily card's path stepper follows the same coverage signal

---

## [0.3.98] — 2026-07-14

### Fixed
- Wrong-answer quiz message no longer fuses the prefix with the option letter into "בחרת בא" — added a maqaf to `rewardWrongPrefix` ("בחרת ב־") in both the `Quiz` and `JS.Quiz` namespaces of `he.json`, and to the hardcoded fallback in `public/js/quiz.js`; Arabic already separates with a space and needed no change

---

## [0.3.97] — 2026-07-14

### Added
- `qa/RUNNING.md` — how to run the agentic QA end-to-end (run a charter, read results, file approved issue drafts, write new charters)

### Changed
- `/qa-explore` teardown now backs up each run dir to `~/qa-runs-backup/` — `qa/runs/` is gitignored, so the copy outside the repo is the durable one

---

## [0.3.96] — 2026-07-14

### Changed
- Hardened API routes: malformed JSON bodies now return a clean 400 via a shared `parseJsonBody` helper (`src/lib/api.ts`) in the quiz/progress/schedule/push/send-otp routes instead of throwing an unhandled 500
- Schedule PUT now replaces the weekly schedule atomically through a new `replace_user_schedule` Postgres function (migration `008_replace_user_schedule.sql`) — a failed insert can no longer wipe the user's existing schedule
- Supabase write errors are no longer swallowed: progress update/insert, the quiz answer upsert, the topics questions query, and push subscribe/unsubscribe now return 500 on failure (quiz gamification side-writes log and continue); the push 500 no longer leaks the raw DB error message
- Added rate limiting to the progress (20/min), schedule (10/min), and push subscribe/unsubscribe (10/min shared) mutations; push route error strings normalized to Hebrew
- Removed the completed harden-API-routes item from `TODO.md` and renumbered the rest

---

## [0.3.95] — 2026-07-14

### Fixed
- Gender agreement in the home streak banner: "עוד {count} ימים למדליה הבא" → "למדליה הבאה", and `daysToMedalOne` now uses מדליה instead of אות for consistency (Arabic strings were already correct)

---

## [0.3.94] — 2026-07-14

### Fixed
- `getTopicAccuracy` now pages through all of a user's quiz responses in 1000-row chunks (ordered by `question_id` for stable ranges) instead of relying on a single request — Supabase caps responses at 1000 rows and the question bank has 1,273 questions, so a learner who had answered more than 1000 unique questions would have had responses silently dropped from per-topic accuracy, skewing or hiding weakest topics (post-merge review catch on #88)

---

## [0.3.93] — 2026-07-14

### Added
- QA runs now emit ready-to-file GitHub issue drafts per finding under `qa/runs/<run>/proposed-issues/` (title, suggested labels, repro/expected/actual/evidence body); the agent never files them — a human reviews and runs `gh issue create --body-file …` for the approved ones
- Committed `.claude/settings.json` with permission deny rules blocking `gh issue` mutations and GitHub-MCP issue tools repo-wide — a mechanical backstop for the QA human-review gate (PR/push tooling stays allowed for normal development)

---

## [0.3.92] — 2026-07-14

### Added
- Exam-readiness card on the home page: projected pass probability estimated from the user's last 5 mock-exam attempts (recency-weighted score mapped through a logistic curve centered on the 26/30 pass mark, clamped to 5–95%), with a low/medium/high chip and an empty-state prompt to take a first mock exam
- "Weakest topics" section on the home page: per-topic accuracy computed from `user_quiz_responses` (new `getTopicAccuracy` in `src/lib/db.ts`), surfacing up to 3 topics below 85% accuracy with at least 5 answered questions, each linking straight to `/topics/{slug}` practice
- New pure model module `src/lib/readiness.ts` (`computeReadiness`, `findWeakestTopics`) with full unit tests; new `Home` namespace strings in both `messages/he.json` and `messages/ar.json`

### Changed
- Removed the completed exam-readiness item from `TODO.md`

---

## [0.3.91] — 2026-07-14

### Added
- Agentic exploratory QA framework (pilot): `/qa-explore` skill that runs charter-driven browser QA sessions against a dedicated test Supabase project and produces evidence-backed structured reports under `qa/runs/` (`qa/PLAN.md` documents the design)
- QA charter format (`qa/charters/TEMPLATE.md`) with persona, environment, oracles, out-of-scope, known issues, and a per-check verdict contract; pilot charter `001-home-and-quiz` covering login redirect, dashboard, quiz loop, persistence, console, a11y, and Hebrew copy/RTL checks
- QA tooling scripts: `qa:dev` (guarded dev server on port 3100 loading `.env.qa`), `qa:mint` (one-time login URL for the test user via Supabase admin `generateLink` + `--check` seed sanity), `qa:validate-report` (mechanical anti-false-confidence gate: every check needs a verdict, pass/fail need on-disk evidence, NOT-tested must be non-empty)
- `qa/SETUP.md` one-time environment guide and committed `.env.qa.example`; all QA scripts refuse to run against the production Supabase project

### Changed
- `.gitignore` now tracks `.claude/skills/` (rest of `.claude/` stays ignored) and ignores `qa/runs/`; markdownlint ignores QA run artifacts

---

## [0.3.90] — 2026-07-14

### Fixed
- Magic-link login: `/auth/callback` (which lives outside the `[locale]` segment) was locale-redirected by next-intl to `/he/auth/callback` — a route that doesn't exist — so every emailed login link ended in a 404. The middleware now skips `/auth/callback` (and only it; the error redirect to `/auth/login` still gets its locale prefix). Found by the agentic QA pilot and confirmed against production with a dummy token

---

## [0.3.89] — 2026-07-13

### Added
- Web app manifest (`src/app/manifest.ts`, served at `/manifest.webmanifest`) — the app is now installable as a PWA: standalone display, RTL, dark theme/splash colors, 192/512 icons; name/description sourced from `messages/he.json` with a new `Metadata.shortName` key in both `he.json` and `ar.json`
- Offline support in `public/sw.js`: precaches the static shell (`/js/*.js`, icons, placeholder, manifest) on install; runtime caching with network-first for pages, cache-first for `/_next/static` and `/signs`+`/questions` images, stale-while-revalidate for `/js` and `/icons` — previously visited flashcards and practice pages now work offline. Redirected responses (auth guard) are never cached, and `/api`, RSC payloads, POSTs, and cross-origin requests are never intercepted; versioned caches are cleaned up on activate. Existing push/notification handlers unchanged
- Cookie-driven `theme-color` meta via `generateViewport` in the root layout
- Tests: manifest fields, `generateViewport`, proxy skip paths for `/manifest.webmanifest` + `/sw.js`, and a full `sw.js` suite (install/activate lifecycle, every caching strategy, non-interception guards, push regression)

### Changed
- `src/proxy.ts` skip-regex: stale `manifest.json` entry replaced with `manifest.webmanifest`
- Removed the completed PWA item from `TODO.md` and renumbered the remaining items

---

## [0.3.88] — 2026-07-13

### Added
- Mock exam mode (סימולציית מבחן תיאוריה) mirroring the real Israeli theory test: `/exam` landing page with rules and attempt history (date, score, pass/fail chip, best score), and `/exam/run` — 30 random questions drawn across all topics with a 40-minute countdown timer, prev/next navigation, changeable answers, and pass ≥ 26
- `POST /api/exam` scores the whole exam server-side in one request (rate-limited 5/min) and records it in the new `user_exam_attempts` table (migration `007_exam_attempts.sql`, RLS-protected, per-question results stored as JSONB for future analytics)
- Unlike practice quizzes, the exam page ships **no** `data-correct` attributes or explanations to the client — answers stay secret until submit; the results screen then decorates every question for review
- `public/js/exam.js` drives the exam client-side (timer with under-5-minutes warning, auto-submit on timeout, unanswered-questions confirm, retryable submit errors) with full DOM-fixture test coverage
- Entry points: mock-exam CTA card on the home page and a nav row in the More page (new `timer` icon in `Icon.tsx` + `design-system/icons.svg`); all strings added to both `messages/he.json` and `messages/ar.json`
- Exam answers deliberately do not touch `user_quiz_responses`, stars, or streaks — practice history and mistake review stay clean (a pass bonus is a possible future add-on)

### Changed
- Removed the completed mock-exam item from `TODO.md` and renumbered the remaining items; the exam-readiness item now points at `user_exam_attempts`

---

## [0.3.87] — 2026-07-13

### Fixed
- Security: `/api/cron/notify` now fails closed — when `CRON_SECRET` is unset the endpoint returns 500 "Server misconfigured" instead of running unauthenticated; any request without the correct `Bearer` token gets 401 before any service-role work happens. Tests updated to authenticate by default, plus new cases for the missing-secret and missing-header paths

### Changed
- Removed the completed cron fail-closed item from `TODO.md` and renumbered the remaining items

---

## [0.3.86] — 2026-07-13

### Changed
- Repopulated `TODO.md` with the next 10 priority-ordered items from an in-depth codebase audit — cron endpoint fail-open security fix, mock exam mode, PWA manifest + offline support, exam-readiness analytics, API-route hardening, Arabic localization of API/notification strings, nested-`<html>` layout fix, quiz-flow accessibility, tests for `public/js/`, and flashcards/image performance — plus a "Later" backlog (spaced repetition, bookmarks, DB-backed videos/resources, scripts cleanup)

---

## [0.3.85] — 2026-07-13

### Added
- Quiz-session tracking: `quiz.js` now generates one `session_id` (UUID) per quiz run and sends it with every answer; `/api/quiz` validates it and stamps it on the `user_quiz_responses` upsert (migration `006_quiz_responses_session_id.sql` adds the nullable column)
- Review page scope toggle — "last session" (default) / "all time" segmented control driven by a `?scope=all` search param; `getMistakesForTopic` gained a `MistakeScope` parameter. When the newest response predates the migration (no `session_id`), the last-session view falls back to all-time so real mistakes are never hidden
- Dedicated empty state for a clean last session that still has older mistakes: "אין טעויות בתרגול האחרון!" plus a button jumping to the all-time view

### Changed
- Retry page now practices the **last session's** mistakes instead of all-time; the review page hides its retry button whenever the last session is clean, so it can't bounce straight back to an empty review

---

## [0.3.84] — 2026-07-13

### Changed
- Quiz reward banner is now meaningful: the star pill is a persistent session score counter (starts at 0, +10 per correct answer) and a transient "+10" floats up out of the pill on each correct answer (respects `prefers-reduced-motion`). Previously a static "+10 יפה מאוד!" badge was always visible because the `.rewardBanner` CSS class overrode the `hidden` attribute
- Feedback message next to the pill is empty until an answer is confirmed, announces via `aria-live`, and clears when advancing to the next question; the score pill carries a localized `aria-label` (new `Quiz.scoreLabel` string in `he`/`ar`)

### Added
- `quiz-script.test.ts` — 6 DOM-fixture tests exercising the real `public/js/quiz.js` scoring and feedback behavior, plus reward-banner render assertions in the quiz and retry page tests

---

## [0.3.83] — 2026-07-13

### Added
- `InlineMarkdown` component (`src/components/InlineMarkdown.tsx`, via new `react-markdown` dependency): renders the AI-generated quiz explanations' markdown (`**bold**`, `*italic*`) as real formatting instead of literal asterisks. Inline-only — paragraphs are unwrapped and anything else (links, code, raw HTML) degrades to plain text, so the output stays valid and safe inside the answer button

### Fixed
- Quiz explanation no longer renders side-by-side with the answer (which squashed the answer to one word per line): the answer now spans the card on top with the explanation on its own full-width row below (`.quiz-option` wraps; explanation gets `flex-basis: 100%`)
- Explanation text color changed from `--text-muted` to `--text` — the muted color on the green correct-answer background failed WCAG AA in light mode (3.76:1); it now measures 13.0:1 light / 10.4:1 dark

---

## [0.3.82] — 2026-07-13

### Security
- Upgraded `next` from 16.2.10 to 16.3.0-preview.5, which pins `postcss` 8.5.10 instead of the vulnerable 8.4.31, fixing CVE-2026-41305 (GHSA-qx2v-qp2m-jg93, moderate): XSS via unescaped `</style>` in PostCSS's stringified output. No stable Next.js release carries the patched postcss yet. Not exploitable in this app (no user-submitted CSS is ever processed), but this removes the vulnerable version from the dependency graph and clears the Dependabot alert.

### Changed
- Ignore `AGENTS.md`/`CLAUDE.md` in `.gitignore` and markdownlint — Next 16.3's postinstall auto-generates these agent-rules files in the repo root

---

## [0.3.81] — 2026-07-13

### Added
- Shared `Icon` component (`src/components/Icon.tsx`) with a typed 14-icon map mirroring `design-system/icons.svg`; all 21 inline SVGs across `TabBar` and the home, more, login, credits, resources, videos, and topic quiz/retry pages now render through it
- `icon-heart` and `icon-globe` symbols in `design-system/icons.svg` so the sprite stays the canonical superset of app icons

### Changed
- More-page stat cards now use the design-system flame/star icons (previously one-off Lucide shapes that differed from the same stats on the home page); decorative icons in `TabBar` and the more page now set `aria-hidden`

### Removed
- Stale "SVG sprite" entry in `TODO.md` — the mockup consolidation shipped in v0.3.64

---

## [0.3.80] — 2026-07-13

### Added
- Raised branch coverage from 91.59% to 97.85% (well above the 90% threshold) with 33 new unit tests: locale-fallback branches (`ar` → `he`) across the home, quiz, retry, review, flashcards, and more pages; time-of-day greeting branches on the home page; error paths in the quiz API (failed upsert, failed medal insert, missing stats); `Intl` weekday fallbacks in the cron notify route; and single-branch gaps in the proxy, locale layout, login metadata, schedule route, and `getMistakesForTopic`

---

## [0.3.79] — 2026-07-13

### Fixed
- Fixed `audit_sign_images.py` docname number extraction to use `(?<!\d)` lookbehind, correctly handling all separator styles (`_`, `-`, start-of-string); previously `(?:_|^)` missed sign 604 whose docname is `drawing-15.svg`

---

## [0.3.78] — 2026-07-13

### Fixed
- Fixed `audit_sign_images.py` regex again: `(?:_|^)` missed numbers after `-` (e.g. `drawing-15.svg`); replaced with `(?<!\d)` which handles all separator characters uniformly

---

## [0.3.77] — 2026-07-13

### Fixed
- Fixed wrong sign images for signs 604 and 935: switched from incorrect SVG to authoritative PNG (extracted from the official Israeli Ministry of Transport PDF)
- Added `scripts/audit_sign_images.py` to detect sign image mismatches via `sodipodi:docname` metadata, with correct handling of both simple (`125.svg`) and Wikimedia-style (`Israel_road_sign_151.svg`) docname formats

---

## [0.3.76] — 2026-07-13

### Fixed
- Fixed `audit_sign_images.py` regex to match sign numbers preceded by `_` (Wikimedia-style docnames like `Israel_road_sign_151.svg`); previously `\b` failed to match because `_` is a word character, silently skipping 50 additional mismatches

---

## [0.3.75] — 2026-07-13

### Fixed
- Corrected sign image fix: only signs 604 and 935 had genuinely wrong images; reverted the other 19 signs back to SVG (higher quality than PNG)

---

## [0.3.74] — 2026-07-13

### Fixed
- Fixed wrong sign images on flashcards: 21 SVG files contained the wrong sign's artwork (detectable via `sodipodi:docname`); switched those signs to use the authoritative PNG files extracted from the official Israeli traffic signs PDF
- Restored test coverage above 90% by adding tests for all 10 locale pages and `lib/navigation`
- Excluded `scripts/` from `tsconfig.json` to fix Vercel build (translation scripts use DB columns not yet in generated types)

## [0.3.73] — 2026-07-13

### Fixed
- Quiz, retry, and review pages now correctly show Hebrew answer options for the `he` locale; previously `option_a_ar`–`option_d_ar` were preferred unconditionally, causing Arabic text to appear for Hebrew users when those columns were populated

---

## [0.3.71] — 2026-07-13

### Changed
- Updated `proxy.test.ts` to mock `next-intl/middleware` and test locale-prefixed paths and the intl early-return path
- Rewrote `TabBar.test.tsx` to handle the async server component and mock `next-intl/server`
- Updated `SignImage.test.tsx`: replaced style assertions with attribute checks, added `onError` fallback test, added `next/image` shim mock
- Added `LanguageToggle.test.tsx` covering locale label rendering, aria-labels, and router navigation
- Added `src/app/[locale]/__tests__/layout.test.tsx` covering `notFound` on invalid locale, `lang` attribute per locale, `window.__t` injection, and theme cookie
- Added `src/i18n/__tests__/request.test.ts` covering locale selection and unknown-locale fallback
- Annotated root `layout.test.tsx` to clarify it tests the root layout, not the locale layout

---

## [0.3.70] — 2026-07-13

### Changed
- `SignImage`: replaced `<img>` with Next.js `<Image>` for lazy-loading and LCP improvement
- Translation scripts: removed `as any` casts on Supabase `.update()` calls; replaced explicit `SupabaseClient<any, any, any>` type alias with `ReturnType<typeof createClient>`

---

## [0.3.69] — 2026-07-13

### Added
- Full Arabic (MSA) language support — all UI strings, quiz questions, answer options, topic names, sign names, and explanations now render in Arabic when the user navigates to `/ar`
- `next-intl` i18n infrastructure: `[locale]` URL-prefix routing, `messages/he.json` + `messages/ar.json`, locale cookie persistence, browser `Accept-Language` auto-detection
- Language toggle component (`LanguageToggle.tsx`) for switching between Hebrew and Arabic
- DB migration adding `_ar` columns to `topics`, `questions`, and `signs` tables
- One-time translation script (`scripts/translate_arabic.ts`) using Gemini 2.5 Flash to populate all 1273 questions, 277 signs, and 4 topics
- Arabic fallback for quiz answer options — falls back to Hebrew when Arabic translation is absent
- `proxy.ts` now correctly forwards `x-next-intl-locale` request headers so server components resolve the right locale

---

## [0.3.68] — 2026-07-13

### Fixed
- `generate_explanations.ts`: type the `supabase` param as `any` to resolve TS2345 build error (untyped client incompatible with inferred generic)

---

## [0.3.67] — 2026-07-13

### Added
- Populated `explanation_he` for all 1,273 questions via Gemini 2.5 Flash

### Changed
- `generate_explanations.ts`: switched to `SUPABASE_SERVICE_ROLE_KEY` for writes, added pagination to handle >1,000 questions, replaced sequential batches with 10-way concurrency

---

## [0.3.66] — 2026-07-13

### Added
- Document source of exam questions, answers, and images in LICENSE — attributed to the Israeli Ministry of Transport theory exam database, not covered by the MIT license

---

## [0.3.65] — 2026-07-13

### Fixed
- Schedule save was always failing with "שגיאה בשמירה" — the client was sending `start_time` as `HH:MM:SS` but the API only accepts `HH:MM`, causing a 400 on every save attempt

---

## [0.3.64] — 2026-07-13

### Changed
- Consolidate 32 inline SVGs across 8 UI kit HTML mockups into a single `design-system/icons.svg` sprite; icons are now referenced via `<svg><use href="...#icon-id"/>`, eliminating duplication and preserving `currentColor` theming

---

## [0.3.63] — 2026-07-13

### Fixed
- Magic link emails now redirect correctly: removed `next` query param from `emailRedirectTo` (Supabase was treating it as a path prefix, producing `//auth/callback` double-slash URLs that Vercel intercepted as SSO). The post-auth destination is now preserved in a short-lived `auth_redirect` cookie instead.

---

## [0.3.62] — 2026-07-12

### Added
- Retry mistakes: new `/topics/[slug]/retry` page re-queues only wrong answers as a mini-quiz, accessible via a button on the review page
- Push notification icon: added `public/icons/icon-192.png` so the service worker can display the notification icon

---

## [0.3.60] — 2026-07-12

### Added
- ליאור טל driving lesson video ("שיעור נהיגה לפני טסט", `kJ5y5JlkMjc`) added to the topic lessons section on the videos page, tagged "מהשטח"

---

## [0.3.59] — 2026-07-11

### Added
- Streak-to-next-medal nudge on the home page: shows "עוד X ימים לאות הבא" under the greeting so users know how close they are to the next milestone (3 / 7 / 14 / 30 days); displays a congratulatory message once all medals are earned
- `nextMedalTarget()` helper exported from `src/lib/quiz.ts`

### Removed
- "Thank you / Credits" and "Gamification" sections from TODO.md (both shipped)

---

## [0.3.58] — 2026-07-11

### Changed
- Quiz action button label changed from "מה התשובה?" to "צדקתי?"

---

## [0.3.57] — 2026-07-11

### Changed
- Quiz action button label changed from "בדקי תשובה" to "מה התשובה?"

---

## [0.3.58] — 2026-07-11

### Added
- Image placeholder (`public/placeholder.svg`) shown when a question's image file is missing on disk; previously the image slot was silently empty
- `SignImage` now falls back to the placeholder on client-side load errors (`onError`)

---

## [0.3.56] — 2026-07-11

### Added
- Credits page (`/credits`) acknowledging data sources (the official theory exam question bank from data.gov.il, Ministry of Transport sign book, Wikimedia Commons SVGs) and key open-source dependencies (Next.js, Supabase, Google Gemini, Rubik)
- Credits nav row (heart icon) added to the `/more` nav card, below the schedule row

---

## [0.3.54] — 2026-07-11

### Changed
- Improved branch test coverage from 95.82% to 97.05% by adding tests for previously-untested branches: PathProgress step 3 (pct 34–66), `cleanName` delimiter splitting, schedule route insert-error 500 response, schedule route default `duration_minutes`/`notify` values, and `/questions/` image file-existence check in both the quiz and review pages
- Removed non-functional `fs` mock infrastructure (`vi.hoisted`, `vi.mock("fs", ...)`, `mockExistsSync`) from the quiz and review page test files — the real `existsSync` was always called; the mocks had no effect
- Added `public/questions/TEST_IMAGE_DO_NOT_DELETE.png` (1×1 PNG) so file-existence tests use a stable, clearly-named fixture rather than an arbitrary production image
- Standardised non-existent-image references in tests to `TEST_IMAGE_DOES_NOT_EXIST.png`

---

## [0.3.53] — 2026-07-11

### Fixed
- "Identify the sign" quiz questions no longer display the correct-answer sign above the question text — the top image is now suppressed whenever `image_url` is a `/signs/` path and at least one answer option is a sign number. Previously, the `every()` check broke on questions with a "none of the above" text option, revealing the answer before the user could choose.
- Same fix applied to the review page, which had no suppression at all and showed the answer sign at the top for all 53 Type B questions.

---

## [0.3.52] — 2026-07-11

### Fixed
- `getQuestionsForTopic` no longer caps results at 8 — removed the hardcoded limit so all questions for a topic are fetched, enabling topic completion for topics with more than 8 questions
- Added `order("question_number")` to `getQuestionsForTopic` for deterministic question ordering
- Removed the separate `.limit(20)` cap from the `/api/topics/[slug]` REST endpoint

---

## [0.3.51] — 2026-07-11

### Fixed
- Review page no longer shows the previous wrong answer (red highlight) after a user answers a question correctly on retry — caused by a missing RLS UPDATE policy on `user_quiz_responses` that silently blocked the upsert from overwriting the stale row

## [0.3.50] — 2026-07-11

### Fixed
- Add missing assertions to the `setAll` cookie-callback tests in `proxy.test.ts` and `auth/callback/route.test.ts`

---

## [0.3.49] — 2026-07-11

### Changed
- Bump Vitest functions coverage from 92% to 100% by exercising the Supabase SSR cookie callbacks (`getAll`/`setAll`) in proxy and auth callback tests, and adding full test coverage for `markTopicCompleted` in `db.test.ts`

---

## [0.3.48] — 2026-07-11

### Added
- Integrate Vercel Speed Insights (`@vercel/speed-insights`) into the root layout for performance metrics collection

---

## [0.3.47] — 2026-07-11

### Added
- Integrate Vercel Analytics (`@vercel/analytics`) into the root layout for page-view tracking

---

## [0.3.46] — 2026-07-11

### Changed
- Remove completed CSS Modules item from TODO.md

---

## [0.3.45] — 2026-07-11

### Changed
- Extract static inline styles from `SignImage`: add `className` prop, move `flex-shrink`/`display` to `SignImage.module.css`
- Replace conditional `style={{display}}` on quiz-next button with `className` toggle using the existing `styles.hidden` module class
- Remove hardcoded 88px inline style override from review page sign image (uses `size="md"` default)

---

## [0.3.44] — 2026-07-08

### Changed
- Send button now shows a spinning indicator and reads "שולח..." (present tense) instead of "נשלח..." while the magic-link request is in flight
- Added tests covering the button's loading state, text content, and reset behaviour on fetch error and network failure

---

## [0.3.43] — 2026-07-08

### Fixed
- CodeQL: replace internal `fetch` to `/api/progress` in quiz route with a direct db call (`markTopicCompleted`), eliminating the SSRF alert
- CodeQL: cap email to 254 chars before regex validation in `send-otp` route, eliminating the polynomial ReDoS alert

---

## [0.3.42] — 2026-07-08

### Added
- Tests for `send-otp` route: next param appended to emailRedirectTo, default to `/` when omitted, open-redirect rejection for non-relative and `//`-prefixed values

---

## [0.3.41] — 2026-07-08

### Added
- Magic link redirect payload: after clicking the login link, users are sent back to the page they were originally trying to reach instead of the home page

---

## [0.3.38] — 2026-07-08

### Changed
- Raise coverage thresholds: lines 90%, statements 90%, functions 90%, branches 80%

---

## [0.3.37] — 2026-07-08

### Added
- Enforce test coverage minimums that fail CI when coverage drops below the baseline: lines 84%, branches 76%, functions 83%, statements 83%

---

## [0.3.40] — 2026-07-08

### Changed
- Raise vitest branch threshold from 85% to 90%

---

## [0.3.39] — 2026-07-08

### Changed
- Increase branch coverage from 84.53% to 95.61% (371/388) by adding targeted tests across 6 test files
- Raise vitest branch threshold from 80% to 90%

---

## [Unreleased]

### Changed
- Consolidate 32 inline SVGs across 8 UI kit HTML mockups into a single `design-system/icons.svg` sprite; reference icons via `<svg><use href="...#icon-id"/>` to eliminate duplication and preserve `currentColor` theming

## [0.3.61] — 2026-07-12

### Fixed
- Magic link auth failure: show a clear Hebrew error message on the login page when the link has expired or already been used (previously `?error=1` was silently ignored)
- Login page sent-banner now reminds users to open the magic link in the same browser (PKCE verifier is tied to the requesting browser session)
- Auth callback now handles `token_hash` + `type` query params via `verifyOtp()` in addition to the PKCE `code` param, preparing for cross-device magic links once the Supabase email template is updated

### Fixed

- Correct sign 102 Hebrew name to "sharp curve right" (sign 103 is the left variant)

### Added
- Stats card at the top of the more page showing streak days and star points side by side
- High-quality SVG traffic sign images from Wikimedia Commons, replacing PDF-extracted PNGs (202/277 signs upgraded; 75 with no SVG on Commons keep their PNG)

### Fixed
- More page test mock was missing `getUserStats` after it was added to the page

---

## [0.3.34] — 2026-07-08

### Fixed
- Deleted orphaned `src/app/topics/__tests__/page.test.tsx` (topics listing page was removed)
- Updated `TabBar.test.tsx` to reflect new 5-tab structure (סרטונים, קישורים replace נושאים)
- Updated `more/__tests__/page.test.tsx` to assert videos/resources links no longer appear

---

## [0.3.33] — 2026-07-08

### Changed
- Merged topic descriptions into the home page topic cards
- Removed the redundant נושאים (/topics) listing page
- Replaced the נושאים tab in the bottom nav with two new tabs: סרטונים (/videos) and קישורים (/resources)
- Promoted סרטוני לימוד and חומרים שימושיים from the "more" page to first-class TabBar tabs
- Videos and resources pages now show the TabBar instead of a back-button header

---

## [0.3.32] — 2026-07-08

### Changed
- Home screen CTA button text updated from "יאללה, מתחילות!" to "יאללה, לעבודה!"
- Streak subtitle updated from "X ימים ברצף, ממשיכות בקצב שלך." to "X ימים ברצף, קצב טוב."

---

## [0.3.31] — 2026-07-08

### Changed
- Login page "magic link sent" hint text updated to gender-neutral phrasing: "יש ללחוץ על הקישור כדי להיכנס."

---

## [0.3.30] — 2026-07-08

### Fixed
- Sign images in quiz answer options increased from 52px to 96px so they are clearly visible

---

## [0.3.29] — 2026-07-08

### Fixed
- Quiz responses now upsert on `(user_id, question_id)` instead of inserting, so re-answering a question correctly updates the stored row rather than silently failing against the UNIQUE constraint — the mistake review page now reflects the user's latest answer

---

## [0.3.28] — 2026-07-08

### Fixed
- Resend status message on the login sent-banner no longer runs directly into the "נשלח שוב" button — corrected `margin-inline-start` direction for RTL and added a whitespace separator in JSX

---

## [0.3.27] — 2026-07-08

### Changed
- Extracted all `style={{...}}` inline styles from 11 TSX files in `src/` into co-located `.module.css` files
- Static styles become CSS classes; binary state toggles (`isActive`, `done`, `earned`, `isDark`, `selected`) become base + modifier class pairs
- Truly dynamic values (`width: \`${pct}%\``, JS-managed display toggling) stay as inline styles
- Added `aria-current="page"` on active TabBar links in place of inline `fontWeight`
- Fixed `.page .optionStatic { cursor: default }` specificity override for review page quiz options (beats global `.quiz-option`)
- Added `data-active` attribute on active PathProgress step nodes to allow reliable test assertions

---

## [0.3.26] — 2026-07-08

### Changed
- Design system: extracted all inline `style="..."` attributes from 17 HTML files (6 guideline swatches + 11 UI kit screen mockups) into companion `.css` files — one per HTML file
- CSS strategy: element selectors (`h1`, `h2`, `button`, `input`, `nav a`, etc.) for semantic elements; classes for layout containers and variants
- `medal-earned.html`: moved embedded `<style>` block (`@keyframes medal-pop`) into `medal-earned.css`
- Replaced hardcoded `12px` font sizes with `var(--type-caption-size)` and `20px` wordmark with `var(--type-h2-size)` across guideline and UI kit CSS files
- Expanded all compact single-line CSS variant rules (swatch modifiers, `@keyframes` steps) to multi-line blocks; `rgba()` converted to modern `rgb()` notation
- Stylelint: added BEM `--` modifier support to `selector-class-pattern`
- TODO: added SVG sprite and CSS Modules tasks under a new Design System section

---

## [0.3.24] — 2026-07-08

### Changed
- Login page: replaced generic `<span>` elements with semantic `h1`, `h2`, `h3`, and `p` elements; wrapped hero and reassurance strip content in card divs

---

## [0.3.22] — 2026-07-08

### Changed
- Login resend button: show "שולח..." loading text while the resend request is in flight, then restore "נשלח שוב" on completion (`public/js/auth.js`)

---

## [0.3.21] — 2026-07-08

### Changed
- Login landing page: button loading state changed from "שולחת..." to "נשלח..." (`public/js/auth.js`)
- Login landing page: resend link label changed from "שלחי שוב" to "נשלח שוב"

---

## [0.3.20] — 2026-07-08

### Changed
- Login landing page: updated CTA heading from "מתחילות עכשיו" to "להתחיל עכשיו" and subtitle from "מתחברות עם" to "להתחברות עם"

---

## [0.3.19] — 2026-07-08

### Changed
- Login landing page: updated three copy strings — flashcard description now reads "שינון תמרורים… מה שלא נזכר", study plan description reworded to "בימים ושעות שנוח לך… ובלי ספירה לאחור", and reassurance strip simplified to "נבנה בשביל הנהגות והנהגים שבדרך"

---

## [0.3.18] — 2026-07-08

### Changed
- Sign images (`public/signs/*.png`): removed external white background via edge flood fill + anti-aliased fringe removal — white content inside signs (borders, text, arrows) is preserved; transparent background renders cleanly on any page color
- Signs where white is integral to the design (sign-112, 113, 148, 508, 618, 635, 713–715, 720–722, 725) kept as original white-background PNGs

---

## [0.3.15]

### Added
- Login page: "לא קיבלת? שלחי שוב" resend link inside the sent-banner — clicking it re-posts to `/api/auth/send-otp` with the stored email, shows "✓ נשלח שוב!" on success, disables the button for 60 s to respect rate limits, and surfaces the server's Hebrew error message (including the 429 rate-limit copy) inline

---

## [0.3.14]

### Added
- `public/robots.txt`: allows all crawlers, disallows `/api/` and `/auth/callback`; references sitemap
- `public/agents.txt`: AI-agent crawl policy (robots.txt-style) with a plain-English description of the app
- `public/llms.txt`: LLM context file following the llmstxt.org spec — app summary, links to key pages, and auth notes
- Pre-commit hook: interactive prompt when `app/**/page.tsx` or `app/**/route.ts` files are staged but crawler files (`robots.txt`, `agents.txt`, `llms.txt`) are not — asks whether they need updating; skips in CI/GUI clients (no TTY)

---

## [0.3.13]

### Added
- Branded favicon set: ל (lamed) learner-sign in plate blue — `icon.svg` (SVG, modern browsers), `apple-icon.png` (180×180, iOS home-screen), `favicon.ico` (32×32 PNG-in-ICO, legacy fallback), and `favicon-512.png` for the future web-app manifest

---

## [0.3.12]

### Fixed
- CI: remove explicit `version` from `pnpm/action-setup` step so it reads from `packageManager` in `package.json`, avoiding version conflict

---

## [0.3.11]

### Added
- GitHub Actions workflow (`.github/workflows/coverage.yml`): runs `pnpm test:coverage` on every PR and posts a per-file coverage table as a PR comment via `davelosert/vitest-coverage-report-action@v2`
- `json-summary` reporter added to Vitest coverage config (required by the coverage report action)

---

## [0.3.10]

### Added
- Design-system: `email-magic-link.html` — branded magic-link email reference (table layout, inline styles, RTL Hebrew); apply in Supabase Auth > Email Templates > Magic Link, replacing `href="#"` with `{{ .ConfirmationURL }}`
- Design-system: `landing.html` — public landing + login reference screen
- Design-system SKILL.md: registered both new screens; added Public page & SEO section

## [0.3.8]

### Added
- Tests for middleware (`src/proxy.ts`): auth redirect on private paths, public-path bypass for /auth/*, /api/auth/*, /signs/*, /questions/*, /js/*, /_next/*, /favicon.ico, Supabase error treated as unauthenticated
- Tests for `src/app/layout.tsx`: dark/light theme from cookie, vapid-public-key meta tag, lang/dir attributes, children rendering
- Tests for `src/app/auth/login/page.tsx`: email input, submit button, headings, form rendering
- Tests for `src/app/schedule/page.tsx`: auth redirect, empty/scheduled state, day button selection, duration buttons, session summary
- Tests for `src/app/topics/[slug]/page.tsx`: auth redirect, notFound, empty state, question rendering, data attributes for JS interop
- Tests for `src/app/flashcards/page.tsx`: auth redirect, sign count, name/number display, cleanName truncation and numeric conversion, action buttons
- Tests for `src/lib/supabase.ts`: createAdminClient/createClient call correct Supabase factories with right keys, cookie delegation

## [0.3.7]

### Changed
- Transformed `/auth/login` from a minimal centered form into a full public landing + login page: hero with h1, login card with heading and subtitle, feature cards (real exam questions, sign flashcards, personal schedule) with traffic sign images, reassurance strip, and footer
- Added SEO metadata and Open Graph tags (title, description, `he_IL` locale) to the login page

## [0.3.6]

### Fixed
- Corrected answer key for signs question 409 (sharp right curve sign): was `a`, now `d`
- Added migration `002_fix_sign_409_correct_answer.sql` to patch the live database

### Added
- Tests for 6 page components (phase 4): home, topics list, more, review, resources, videos — covering auth redirects, progress bar rendering, medal earned/unearned display, correct/wrong option highlighting with explanation text, external link target and rel attributes, and YouTube video link rendering

---

### Added
- Tests for all 8 API routes (phase 3): logout, send-otp, auth callback, progress, push/subscribe, schedule, topics/[slug], cron/notify — covering auth guards, input validation, business logic branches, and external-service mocking (web-push, Resend)

---

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
