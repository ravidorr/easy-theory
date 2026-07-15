---
id: "001-home-and-quiz"
title: "Authed home dashboard + topic quiz practice flow"
flow: "Login-redirect sanity → minted session → dashboard → enter first topic → complete a quiz → verify progress persistence"
persona: >
  Hebrew-speaking learner preparing for the Israeli theory exam (B license).
  Studies on their phone in short sessions, expects a fully RTL Hebrew UI, and
  cares about their streak and star points. Returning user with an existing account.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB: 1273 questions, 277 signs, seeded topics; test-user progress may exist from earlier runs (checks compare within-run)"
timebox_minutes: 25
out_of_scope:
  - "Push notifications / service worker"
  - "Arabic locale (separate future charter)"
  - "Email sending (send-otp path) — auth is minted"
  - "flashcards / schedule / videos / resources / credits / more pages"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-AUTH-01
    desc: "Unauthed visit to / redirects to the login page"
    oracle: "Final URL is /he/auth/login; login form (email field + submit) visible"
  - id: CHK-AUTH-02
    desc: "Minted session grants access; / lands on the dashboard"
    oracle: "URL is /he; dashboard widgets render; no redirect loop back to login"
  - id: CHK-HOME-01
    desc: "Dashboard shows streak, star points, and per-topic progress"
    oracle: "Values are real numbers (no NaN/undefined/empty); topic list is non-empty and names match the seeded topics"
  - id: CHK-HOME-02
    desc: "Dashboard copy matches messages/he.json Home namespace; layout is RTL"
    oracle: "No raw keys (e.g. 'Home.title') or unexpected English on screen; html has dir=rtl and lang=he"
  - id: CHK-QUIZ-01
    desc: "Entering the first topic loads the quiz"
    oracle: "#quiz-container present; a question with 4 answer options renders; sign image shown when the question has one"
  - id: CHK-QUIZ-02
    desc: "Answer select → confirm → instant feedback loop works"
    oracle: "Selected answer highlights, correct/incorrect feedback shows, #quiz-progress-fill advances between questions"
  - id: CHK-QUIZ-03
    desc: "Each confirmed answer POSTs /api/quiz successfully"
    oracle: "Network log shows POST /api/quiz with 2xx per confirmed answer; no 4xx/5xx"
  - id: CHK-QUIZ-04
    desc: "Completing the quiz shows the final screen and saves progress"
    oracle: "#quiz-final visible with a score; POST /api/progress returns 2xx"
  - id: CHK-QUIZ-05
    desc: "Progress persists: dashboard reflects the completed quiz"
    oracle: "Back on /he, the topic's progress/stats differ from the CHK-HOME-01 screenshot in the expected direction"
  - id: CHK-QUIZ-06
    desc: "Cross-browser continue: quiz opens at the first unanswered question when server progress exists"
    oracle: "Given dashboard topic progress > 0 (e.g. 2/501), clear `localStorage` for the origin (or use a fresh browser profile), open the topic quiz: counter shows the next global index (e.g. 3 מתוך 501), not 1; if every question in the topic is already answered, `#quiz-final` shows with home + review links instead of slide 1"
  - id: CHK-QUIZ-07
    desc: "Same-browser reload still resumes mid-quiz via localStorage"
    oracle: "Answer at least one question, reload mid-quiz without clearing storage: quiz restores the saved slide/index (including a pending retry state when applicable); `quiz-resume:v1:*` in Application → Local Storage matches the visible slide"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on dashboard + quiz"
    oracle: "Images have alt text; buttons/links have accessible names; a heading exists per page; html lang/dir correct; answer feedback is not conveyed by color alone"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (Home/Quiz/TabBar namespaces); no LTR-leaking punctuation or mixed-direction breakage"
exploration_budget: "After all checks, up to 5 min within scope: rapid double-click on confirm, browser back mid-quiz, page reload mid-quiz (same-browser resume per CHK-QUIZ-07), fresh-profile entry with partial server progress (skip-answered per CHK-QUIZ-06), empty-progress edge (if user is fresh)"
---

## Narrative

You are a returning learner opening the app on your phone for a study session. Move
through the app the way a person would: read the dashboard, pick the topic the app
suggests, do a quiz honestly (get some answers right and some wrong — wrong answers
exercise the feedback path), and check that your effort shows up on the dashboard
afterwards.

Route hints:

- Topic links on the dashboard go to `/he/topics/<slug>`. Use the first/suggested topic.
- The quiz is driven by `public/js/quiz.js`: answer options are buttons inside
  `#quiz-container`; confirming an answer POSTs `/api/quiz`; finishing the batch shows
  `#quiz-final` and POSTs `/api/progress`. On a fresh browser session, the page passes
  server-known answered question IDs via `data-answered-ids` and the client starts at
  the first unanswered slide (global counter matches dashboard progress); same-browser
  reload still wins via `quiz-resume:v1:*` in localStorage. If a quiz batch is long,
  answer efficiently — the goal is the loop and its persistence, not deliberation.
- Copy sources: `messages/he.json`, namespaces `Home`, `Quiz`, `TabBar`. Compare what you
  see against these when something reads oddly.
- Meaningful-step screenshots: login redirect, authed dashboard, quiz first question,
  one correct-answer feedback, one wrong-answer feedback, final screen, dashboard after.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
