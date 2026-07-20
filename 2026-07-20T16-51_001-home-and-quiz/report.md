# QA run 2026-07-20T16-51_001-home-and-quiz

11/15 pass, 0 fail, 2 blocked, 2 not checked.

Environment: `http://localhost:3100`, Hebrew, 390x844, app `0.3.200`, commit `6b5149513c9da0a37be915ed8c8106b95ccef521`, QA Supabase `nvgqczaesfeotijjcbed.supabase.co`.

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-AUTH-01 | pass | Unauthenticated root redirected to the Hebrew login form. | screenshots/step-01-unauth-redirect.png |
| CHK-AUTH-02 | pass | Minted session landed on the Hebrew dashboard. | screenshots/step-02-dashboard.png |
| CHK-HOME-01 | pass | Mission, daily count, and seeded topic list rendered. | screenshots/step-02-dashboard.png |
| CHK-HOME-02 | pass | Hebrew copy rendered in RTL with `lang=he`. | screenshots/step-02-dashboard.png |
| CHK-HOME-03 | pass | Mission and simulation CTAs were reachable. | screenshots/step-02-dashboard.png |
| CHK-QUIZ-01 | pass | Topic quiz rendered with four options. | screenshots/step-03-quiz-first-question.png |
| CHK-QUIZ-02 | pass | Wrong feedback and correct-answer auto-advance worked. | screenshots/step-04-wrong-answer-feedback.png; screenshots/step-05-correct-answer-feedback.png |
| CHK-QUIZ-03 | not-checked | Normal submissions returned 200, but rapid automation triggered 429. | — |
| CHK-QUIZ-04 | blocked | Completion was stopped by the QA rate limit; retry recovered. | — |
| CHK-QUIZ-05 | blocked | Depends on completed-quiz persistence. | — |
| CHK-QUIZ-06 | pass | Fresh local storage resumed from server progress at question 69. | screenshots/step-09-fresh-storage-resume.png |
| CHK-QUIZ-07 | pass | Reload resumed at question 68 with locale-scoped local state. | screenshots/step-07-reload-resume.png |
| CHK-CONSOLE-01 | not-checked | Only error was the deliberate rate-limit 429 during burst automation. | — |
| CHK-A11Y-01 | pass | Required headings, named controls, and Hebrew RTL document metadata were present. | screenshots/step-02-dashboard.png; screenshots/step-03-quiz-first-question.png |
| CHK-COPY-RTL-01 | pass | Observed copy matched Hebrew message namespaces without raw keys or direction breaks. | screenshots/step-02-dashboard.png; screenshots/step-04-wrong-answer-feedback.png |

## Findings

No publishable findings. The observed 429 was induced by a rapid automated answer burst and the in-product retry succeeded with 200.

## NOT tested

- Quiz final screen and `/api/progress` completion request.
- Post-completion dashboard persistence assertion.
- Push notifications/service worker, Arabic locale, email delivery, flashcards, schedule, videos, resources, credits, More, and desktop viewport.

## Limitations and next charter

The existing test-user progress meant the vehicle topic began at question 41. A full completion run should be repeated with rate-limit-aware pacing or a reset QA user. Next charter: `002-review-and-retry`.
