---
id: "003-exam-simulation"
title: "Mock exam: landing, timed run, server scoring, history, readiness"
flow: "Exam landing rules → start run → answer 30 questions → submit → result screen → attempt history → home readiness card"
persona: >
  Hebrew-speaking learner a week before their real theory exam. Wants a
  realistic dress rehearsal: strict timer, no feedback until the end, a
  clear pass/fail verdict, and a record of past attempts to track readiness.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB: 1273 questions, 277 signs, seeded topics; exam pulls 30 random questions; prior attempts may exist from earlier runs (history checks compare within-run)"
timebox_minutes: 30
out_of_scope:
  - "Waiting out the 40-minute timer / auto-submit at 0:00"
  - "Timer warning state at <=5:00 (data-warning) — unreachable within timebox"
  - "Topic practice quiz mechanics (001) and mistake review (002)"
  - "Arabic locale (007)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-EXAM-01
    desc: "Exam landing states the rules and offers start + history"
    oracle: "/he/exam shows 30 questions / 40 minutes / pass mark 26 in the copy, a start button, and an attempt-history section (list or empty state)"
  - id: CHK-EXAM-02
    desc: "Exam run renders 30 questions with no answer leakage"
    oracle: "/he/exam/run has #exam-container with data-total=30; no element in the DOM carries data-correct or otherwise reveals the correct option before submission"
  - id: CHK-EXAM-03
    desc: "Navigation and answered-counter work across questions"
    oracle: "#exam-prev/#exam-next move between questions preserving selections; #exam-answered increments once per distinct answered question"
  - id: CHK-EXAM-04
    desc: "Timer counts down during the run"
    oracle: "#exam-timer starts near 40:00 and decreases monotonically across observations"
  - id: CHK-EXAM-05
    desc: "Submitting with unanswered questions asks for confirmation"
    oracle: "With at least one question unanswered, #exam-submit raises the localized confirm dialog; cancel returns to the run without submitting"
  - id: CHK-EXAM-06
    desc: "Submission is server-scored and the result is consistent"
    oracle: "POST /api/exam returns 2xx with score/total/passed; #exam-result shows the same score out of 30 and a pass/fail verdict matching score >= 26"
  - id: CHK-EXAM-07
    desc: "The attempt lands in history with best score maintained"
    oracle: "Back on /he/exam the history contains one new attempt with this run's score and date; best score is the max of before + this attempt"
  - id: CHK-EXAM-08
    desc: "Home readiness card reflects having exam attempts"
    oracle: "On /he the readiness card is not in its empty state and shows a readiness level (values are real, no NaN/undefined)"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on landing, run, and result"
    oracle: "Timer and answered-counter are readable text (not color-only); options have accessible names and selection state; a heading exists per page; the confirm dialog is keyboard-dismissable"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (Exam/JS.Exam namespaces); no raw keys; timer and score digits render without direction breakage"
exploration_budget: "After all checks, up to 5 min within scope: reload mid-exam (what happens to the run?), browser back from /exam/run, double-click submit, start a second exam immediately"
---

## Narrative

Treat this as the real thing: sit the mock exam start to finish. Answer all 30
questions at a steady pace — mix correct and incorrect answers so the score is
mid-range and both the scoring math and the fail path stay honest. Before answering
everything, try submitting early once to exercise the unanswered-confirmation dialog,
then cancel and continue.

Route hints:

- Landing `/he/exam`; runner `/he/exam/run`, driven by `public/js/exam.js`.
  Constants live in `src/lib/exam.ts`: 30 questions, 2400 seconds, pass mark 26.
- Runner hooks: `#exam-container` (`data-total`, `data-duration-seconds`,
  `data-pass-mark`), `#exam-prev`, `#exam-next`, `#exam-submit`, `#exam-timer`,
  `#exam-answered`, `#exam-error`, `#exam-result` (+ `#exam-result-title`,
  `#exam-result-score`, `#exam-review-btn`).
- Scoring is server-side via POST `/api/exam` — the page never receives correct
  answers up front; verify the DOM to prove it.
- Copy sources: `messages/he.json`, namespaces `Exam`, `JS.Exam`.
- Meaningful-step screenshots: landing with rules, first question, answered-counter
  mid-run, unanswered-submit confirm dialog, result screen, landing history after,
  home readiness card after.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
