---
id: "007-arabic-locale"
title: "Arabic locale sweep: UI copy, DB content, RTL, locale persistence"
flow: "Mint into /ar → dashboard → short topic quiz → flashcards → more, verifying Arabic copy and content throughout"
persona: >
  Arabic-speaking learner preparing for the Israeli theory exam. Uses the
  app entirely in Arabic on their phone, expects a fully RTL Arabic UI with
  Arabic question and sign content, and should never need to read Hebrew
  to use the product.
environment:
  base_url: "http://localhost:3100"
  locale: "ar"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint --next /ar"
  data_assumptions: "Seeded test DB with Arabic columns from migration 005 and Arabic content imported separately; migration 015 supplements question 15 in the signs topic. Arabic routes never fall back to Hebrew when an _ar value is missing"
timebox_minutes: 25
out_of_scope:
  - "Deep flow mechanics already proven in Hebrew charters (001-006) — this run checks localization, not logic"
  - "Exam, schedule, review/retry in Arabic (spot-check only if time remains)"
  - "Arabic email/notification content (Notify namespace, cron)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-AR-01
    desc: "Minted session lands on the Arabic dashboard"
    oracle: "Final URL is /ar; html has lang=ar and dir=rtl; the NEXT_LOCALE cookie is ar"
  - id: CHK-AR-02
    desc: "Dashboard chrome is fully Arabic"
    oracle: "Greeting, pills, topic cards, and tab bar show copy from messages/ar.json; no raw keys and no Hebrew strings in UI chrome (DB topic names in Arabic where name_ar exists)"
  - id: CHK-AR-03
    desc: "Quiz content is served in Arabic"
    oracle: "In a topic quiz under /ar, question text and options come from the _ar columns; feedback and button labels match ar.json (JS.Quiz); no Hebrew question, option, explanation, or sign name is rendered as a fallback. A missing required Arabic value is a data/content defect."
  - id: CHK-AR-04
    desc: "Flashcards show Arabic sign names"
    oracle: "/ar/flashcards flips reveal name_ar-based names; UI labels come from ar.json Flashcards namespace"
  - id: CHK-AR-05
    desc: "More page and language toggle behave in Arabic"
    oracle: "/ar/more is fully Arabic; the language toggle returns to /he/more and back, preserving the page and updating NEXT_LOCALE each way"
  - id: CHK-AR-06
    desc: "Locale persists across navigation and reload"
    oracle: "All in-app links stay under /ar; a full reload of /ar pages keeps lang=ar; visiting bare / redirects to /ar per the cookie"
  - id: CHK-AR-07
    desc: "Dates and numbers are localized"
    oracle: "Any visible dates use Arabic locale formatting (ar-IL); counters and scores render as real values without direction breakage"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics under the Arabic locale"
    oracle: "html lang/dir correct on every page; images keep alt text (Arabic where localized); buttons/links have accessible names; a heading exists per page"
  - id: CHK-COPY-RTL-01
    desc: "No mixed-direction or truncated Arabic strings"
    oracle: "No LTR-leaking punctuation, clipped labels, or overlapping text caused by Arabic string lengths; all visible strings exist in ar.json"
exploration_budget: "After all checks, up to 5 min within scope: deep-link directly to /ar/topics/<slug>, switch language mid-quiz, compare one screen side-by-side with its Hebrew version for layout drift"
---

## Narrative

You live in the Arabic UI. Repeat a compressed version of a normal study session —
read the dashboard, answer a few quiz questions (2-3 are enough; the logic is already
proven in Hebrew), flip a few flashcards, glance at More — but your attention is on
words and layout, not mechanics: is every label Arabic, does the DB content come from
the `_ar` columns, does anything clip or flip direction?

Arabic routes intentionally use Arabic DB fields only. Hebrew content in a question,
option, explanation, or sign name is a defect; a missing Arabic value that produces
blank required content is also a data/content defect. Record the exact question or sign
identifier in either case.

Route hints:

- Mint directly into Arabic: `pnpm qa:mint --next /ar`.
- Locale routing: `/ar/...` prefix, `NEXT_LOCALE` cookie, toggle via the More page.
  UI copy: `messages/ar.json` (namespaces mirror he.json; parity is test-enforced).
- DB content: `question_ar`, `option_a_ar`..`option_d_ar`, `explanation_ar`,
  sign `name_ar` (introduced in migration 005 and supplemented by migration 015).
- Meaningful-step screenshots: Arabic dashboard, one Arabic quiz question with
  feedback, an Arabic flashcard back, /ar/more, and any missing/non-Arabic content
  with its question or sign identifier.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
