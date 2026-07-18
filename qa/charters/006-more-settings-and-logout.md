---
id: "006-more-settings-and-logout"
title: "More hub: expanded stats, achievements, settings, bookmarks, logout"
flow: "Open More → cross-check stats vs dashboard → achievements + navigation → theme/auto-advance settings → language round-trip → logout kills the session"
persona: >
  Hebrew-speaking returning learner poking around the settings area. Cares
  that their stats match what the home page brags about, prefers dark mode
  at night, and expects logout to actually log them out on a shared phone.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB; test user has some progress/streak from earlier runs (stats cross-check is home-vs-more within the same run, not absolute values)"
timebox_minutes: 25
out_of_scope:
  - "Full Arabic content sweep (007) — only the toggle round-trip is checked here"
  - "Earning new medals (covered by quiz flows)"
  - "Login flow after logout (008)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-MORE-01
    desc: "More page stats agree with the home dashboard and remain complete"
    oracle: "Streak, star points, and level shown on /he/more equal their home values captured in the same run; More's accuracy, answered-question, and completion values render as intentional values or intentional empty treatment (no NaN/undefined/empty layout)"
  - id: CHK-MORE-02
    desc: "Achievements grid renders streak medals and derived achievements"
    oracle: "The grid includes streak medals (3/7/14/30) and achievement tiles for first topic, 100 questions, all topics, and exam pass; earned vs locked state is visually and programmatically distinguishable, including for a zero-progress user"
  - id: CHK-MORE-03
    desc: "Navigation entries lead where they claim"
    oracle: "Links/rows for exam, schedule, bookmarks, and credits navigate to /he/exam, /he/schedule, /he/bookmarks, and /he/credits respectively"
  - id: CHK-MORE-04
    desc: "Dark-mode toggle flips the theme and persists"
    oracle: "#dark-mode-toggle flips html[data-theme] between dark and light immediately; after a full reload the chosen theme is still applied (theme cookie); toggle state matches the applied theme"
  - id: CHK-MORE-05
    desc: "Language toggle round-trips to Arabic and back in place"
    oracle: "The language toggle navigates /he/more to /ar/more (html lang=ar, Arabic copy) and back to /he/more; the NEXT_LOCALE cookie follows the choice; no redirect to home or login in between"
  - id: CHK-MORE-06
    desc: "Logout terminates the session"
    oracle: "#logout-btn POSTs /api/auth/logout with 2xx and lands on /he/auth/login; afterwards navigating to /he redirects back to the login page (no cached authed page with working data)"
  - id: CHK-MORE-07
    desc: "Auto-advance setting persists and controls the practice-quiz loop"
    oracle: "#auto-advance-toggle exposes and changes its switch state, persists the `quiz-auto-advance` cookie through reload, and when off a correct practice answer remains on feedback until manually advanced; restoring it on permits the normal automatic advance"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on the More page"
    oracle: "Theme, auto-advance, and language controls expose role and state (aria-checked/pressed); achievement earned-state is not color-only; rows/links have accessible names; a heading exists"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (More namespace); no raw keys or unexpected English; numbers in stats render without direction breakage"
exploration_budget: "After all checks, up to 5 min within scope: browser back immediately after logout, toggling theme rapidly, theme persistence across the language toggle, deep-link /he/more in light theme"
---

## Narrative

Evening session on the couch: open the More tab, check your numbers match what the
home screen told you, inspect the expanded achievements, open saved questions, switch
to dark mode, toggle quiz auto-advance, and peek at the Arabic UI before switching
back. End the session by logging out
and making sure the app is genuinely locked afterwards — this is a shared phone.

Do the logout LAST: it kills the minted session, and every check after it would be
blocked. If more authed checks remain, re-mint via `pnpm qa:mint`.

Route hints:

- Page `/he/more`, driven by `public/js/more.js` (theme + logout) and the
  `LanguageToggle` component (locale swap in place via the router).
- Hooks: `#dark-mode-toggle` (sets the `theme` cookie and `html[data-theme]`),
  `#auto-advance-toggle` (sets the `quiz-auto-advance` cookie), and `#logout-btn`
  (POST `/api/auth/logout` then `/auth/login`).
- Theme default is dark; the layout reads the cookie server-side, so a reload is the
  persistence proof.
- Copy sources: `messages/he.json` (and `ar.json` for the toggle round-trip),
  namespace `More`.
- Meaningful-step screenshots: More page top (stats), achievements grid, bookmarks
  navigation, dark vs light theme, auto-advance off state, /ar/more during the
  round-trip, login page after logout, redirect-to-login proof after logout.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
