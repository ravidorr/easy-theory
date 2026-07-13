# Changelog

All notable changes to ClearRoad (דרך ברורה) are documented here.

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
