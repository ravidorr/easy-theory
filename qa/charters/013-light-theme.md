---
id: "013-light-theme"
title: "Light theme sweep: toggle, persistence, and readability across core pages"
flow: "More → switch to light theme → sweep dashboard, quiz, review, flashcards, schedule → reload persistence → switch back to dark"
persona: >
  Hebrew-speaking learner who studies outdoors during the day and cannot
  read the default dark UI in sunlight. Switches to light mode once and
  expects the entire app - every page, every state - to follow, stay that
  way tomorrow, and be just as readable as dark mode.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB: 1273 questions, 277 signs, seeded topics; default theme is dark (theme cookie absent); the run flips the cookie via the UI and restores it at the end"
timebox_minutes: 25
out_of_scope:
  - "Theme toggle mechanics on the More page beyond what the sweep needs (covered by 006)"
  - "Flow logic and persistence (covered by 001-005; this run checks theming)"
  - "OS-level prefers-color-scheme behavior (the app uses an explicit cookie, not the media query — verify and note if otherwise)"
  - "Arabic locale in light theme (007 covers Arabic in the default theme)"
  - "Desktop viewport (012)"
known_issues: []
checks:
  - id: CHK-THEME-01
    desc: "Toggling on More switches the whole app to light immediately"
    oracle: "#dark-mode-toggle flips html[data-theme] to light without a reload; the More page itself re-renders with light backgrounds and dark text"
  - id: CHK-THEME-02
    desc: "Every swept page renders in light theme"
    oracle: "/he, a topic quiz, its review page, /he/flashcards, and /he/schedule all render with html[data-theme=light] and no dark-theme remnant panels (no dark cards or sections keeping dark-mode backgrounds)"
  - id: CHK-THEME-03
    desc: "Light theme survives reload and navigation"
    oracle: "After a full reload and after navigating between pages, html[data-theme] is still light (theme cookie read server-side, so the first paint is already light - no dark flash on load)"
  - id: CHK-THEME-04
    desc: "Text remains readable in light theme"
    oracle: "On the swept pages, body text, pills, badges, and button labels have visibly sufficient contrast (spot-check computed colors of body text, quiz options, and the streak/points pills; nothing renders light-on-light)"
  - id: CHK-THEME-05
    desc: "Quiz feedback states are distinguishable in light theme"
    oracle: "Answer a question each way: selected, correct, and wrong option states are visually distinct in light mode and the textual badges remain present (not relying on dark-theme colors)"
  - id: CHK-THEME-06
    desc: "Images and icons stay visible on light backgrounds"
    oracle: "Sign/question images, tab bar icons, and decorative icons are visible in light theme (no white-on-white icons or images with dark-only transparency)"
  - id: CHK-THEME-07
    desc: "Browser chrome theme color follows the theme"
    oracle: "The document theme-color (meta/viewport themeColor) matches the light palette when data-theme=light, per the layout's generateViewport"
  - id: CHK-THEME-08
    desc: "Switching back to dark restores everything"
    oracle: "Toggling back on /he/more returns html[data-theme=dark] immediately and after reload; no page keeps light styling"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the sweep"
    oracle: "Browser console contains zero error-level entries across the toggle and all swept pages (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics hold in light theme"
    oracle: "Focus indicators remain visible on light backgrounds; correct/wrong feedback still carries its textual/sr markers; headings and accessible names unchanged; html lang/dir correct"
  - id: CHK-COPY-RTL-01
    desc: "No theme-dependent copy or layout breakage"
    oracle: "All visible strings unchanged from dark mode and still traced to he.json; no layout shift, clipped labels, or direction breakage introduced by the light palette"
exploration_budget: "After all checks, up to 5 min within scope: rapid double-toggle of the theme, theme state after logout/login-page visit (login is public - which theme does it render?), deep-link straight into a quiz with the light cookie already set"
---

## Narrative

Midday on a park bench: the dark UI is a mirror, so you switch to light and carry on
with a normal study session. Your attention is a designer's, not a logician's - on
every screen ask: did the whole surface actually switch, can I read everything, do
the quiz colors still tell me right from wrong? Dark mode is the default and gets all
the daily use; light mode is where half-themed components hide.

Do the sweep in this order so persistence is proven along the way: toggle on
`/he/more`, then WITHOUT reloading visit `/he` and a topic quiz (answer one question
correctly and one wrongly for CHK-THEME-05), then reload the quiz page mid-sweep
(CHK-THEME-03 - watch the first paint for a dark flash), then review, flashcards,
schedule, and back to More to restore dark.

Route hints:

- Theme machinery: `#dark-mode-toggle` on `/he/more` (driven by `public/js/more.js`)
  sets the `theme` cookie and `html[data-theme]`; the locale layout reads the cookie
  server-side, and `generateViewport` derives the themeColor. Default is dark.
- Contrast spot-check from the console: `getComputedStyle(el).color` /
  `.backgroundColor` on body text, a quiz option in each state, and the pills.
- Restore the dark default before finishing (toggle back), so later runs start from
  the documented default state.
- Meaningful-step screenshots: More in dark before, More in light after the toggle,
  each swept page in light, the quiz correct + wrong feedback in light, first paint
  after reload, More back in dark.

Severity rubric: blocker / major / minor / cosmetic / question - see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product
decision, file it as `question`, not `minor`.
