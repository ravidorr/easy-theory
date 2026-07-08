# Changelog

All notable changes to ClearRoad (דרך ברורה) are documented here.

## [Unreleased]

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
