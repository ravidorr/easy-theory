---
id: "002-review-and-retry"
title: "Mistake review page + throwaway retry session"
flow: "Seed mistakes via a quiz → review last-session mistakes → all-time scope → retry the mistakes → verify retry persists nothing"
persona: >
  Hebrew-speaking learner who just finished a practice quiz and got several
  questions wrong. Wants to understand what they missed and immediately
  re-practice those exact questions without it counting against their
  saved topic progress.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB: 1273 questions, 277 signs, seeded topics; the run seeds its own mistakes by deliberately answering wrong in the setup quiz"
timebox_minutes: 25
out_of_scope:
  - "Quiz answer/confirm mechanics beyond what setup needs (covered by 001)"
  - "Review/retry in Arabic locale (007)"
  - "Exam-result review (003)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-REVIEW-01
    desc: "Review page lists exactly the questions answered wrong in the setup quiz"
    oracle: "/he/topics/<slug>/review shows one row per wrong answer from the setup session; each row shows the question, the user's wrong pick, and the correct answer; no rows for questions answered correctly"
  - id: CHK-REVIEW-02
    desc: "Scope toggle switches between last-session and all-time mistakes"
    oracle: "The all-time option links to ?scope=all; the active option carries data-active and aria-current; the all-time list is a superset of (or equal to) the last-session list"
  - id: CHK-REVIEW-03
    desc: "Review empty state renders when a scope has no mistakes"
    oracle: "On a topic with no last-session mistakes (or before the setup quiz), the empty state shows localized copy and offers the all-time scope link instead of an empty table"
  - id: CHK-RETRY-01
    desc: "Retry page runs a quiz over exactly the last-session mistakes"
    oracle: "/he/topics/<slug>/retry shows #quiz-container with data-quiz-mode=retry; data-total equals the last-session mistake count; the questions match the reviewed ones"
  - id: CHK-RETRY-02
    desc: "Retry answers still submit, but the session is throwaway"
    oracle: "Each confirmed retry answer POSTs /api/quiz with 2xx; on finish there is NO POST /api/progress; no quiz-resume:v1:* key appears in localStorage during the retry"
  - id: CHK-RETRY-03
    desc: "Retry does not change saved topic progress"
    oracle: "Dashboard topic progress/status for the topic is identical before and after the retry session (screenshot comparison)"
  - id: CHK-RETRY-04
    desc: "Retry with no last-session mistakes redirects to review"
    oracle: "Visiting /he/topics/<other-slug>/retry for a topic with no last-session mistakes lands on /he/topics/<other-slug>/review (no blank quiz, no error)"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on review + retry"
    oracle: "Scope toggle is a labeled group with aria-current on the active option; images have alt text; buttons/links have accessible names; a heading exists per page; correct/wrong in review rows is not conveyed by color alone"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (Review/Retry/Quiz namespaces); no raw keys; no LTR-leaking punctuation or mixed-direction breakage"
exploration_budget: "After all checks, up to 5 min within scope: reload mid-retry (should restart, not resume), browser back from retry to review, deep-link ?scope=all directly, retry twice in a row"
---

## Narrative

You just finished a practice session and know you got things wrong. Open the topic you
practiced, find your mistakes, read why you were wrong, and re-drill exactly those
questions. The retry is a scratchpad: it must feel like a real quiz but leave no trace
on your saved progress.

Setup: this charter seeds its own data. First run a short quiz on one topic
(`/he/topics/<slug>`) and deliberately answer 3-5 questions wrong, noting which ones.
Complete the quiz so the session is recorded. That session's wrong answers are the
expected review content.

Route hints:

- Review page: `/he/topics/<slug>/review`, scope via `?scope=all`
  (default is last session). Active scope option has `data-active` and
  `aria-current="page"`.
- Retry page: `/he/topics/<slug>/retry`. Driven by `public/js/quiz.js` in retry mode:
  `#quiz-container[data-quiz-mode="retry"]`. Retry never writes the
  `quiz-resume:v1:<userId>:<topicId>` localStorage key and never POSTs
  `/api/progress`; it DOES still POST `/api/quiz` per confirmed answer.
- A topic with no last-session mistakes redirects `/retry` → `/review` server-side.
- Copy sources: `messages/he.json`, namespaces `Review`, `Retry`, `Quiz`.
- Meaningful-step screenshots: setup quiz wrong-answer feedback, review list
  (last session), review list (all time), review empty state, retry first question,
  retry final screen, dashboard before/after retry.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
