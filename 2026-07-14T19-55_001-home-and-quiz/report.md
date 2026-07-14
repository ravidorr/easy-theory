# QA report: authed home dashboard and topic quiz

Run: `2026-07-14T19-55_001-home-and-quiz`

Charter: `qa/charters/001-home-and-quiz.md`

## Environment

- Git SHA: `cd095d1a60cee1421a6faac16f49b51a18218cff`
- App version: `0.3.130`
- Base URL: `http://localhost:3100`
- Viewport: `390x844`
- Locale: `he`
- Supabase host: `nvgqczaesfeotijjcbed.supabase.co`
- Started: `2026-07-14T16:55:00Z`
- Finished: `2026-07-14T20:31:00Z`

## Verdict summary

10/12 pass, 2 fail (1 major finding), 0 blocked, 0 not-checked.

## Checks

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-AUTH-01 | pass | Fresh visit redirected to `/he/auth/login`; email and submit controls visible. | [screenshot](screenshots/step-01-login-redirect.png) |
| CHK-AUTH-02 | pass | Minted auth landed on `/he` without login loop. | [screenshot](screenshots/step-02-dashboard-before.png) |
| CHK-HOME-01 | pass | Streak 2, points 410, four topics with numeric progress. | [screenshot](screenshots/step-02-dashboard-before.png) |
| CHK-HOME-02 | pass | Hebrew copy with `lang=he` and `dir=rtl`; no raw keys. | [screenshot](screenshots/step-02-dashboard-before.png) |
| CHK-QUIZ-01 | pass | Quiz showed question, four options, and question image. | [screenshot](screenshots/step-03-quiz-first-question.png) |
| CHK-QUIZ-02 | pass | Correct and incorrect textual feedback; progress advanced. | [correct](screenshots/step-04-correct-feedback.png), [wrong](screenshots/step-05-wrong-feedback.png) |
| CHK-QUIZ-03 | fail | 501 submissions returned 200; 364 returned 429 while UI continued. | [network](network.log), [console](console.log) |
| CHK-QUIZ-04 | pass | Final screen 122/501; `/api/progress` returned 200. | [screenshot](screenshots/step-06-quiz-final.png), [network](network.log) |
| CHK-QUIZ-05 | pass | Dashboard changed 23/501 to 501/501; points 410 to 1540. | [before](screenshots/step-02-dashboard-before.png), [after](screenshots/step-07-dashboard-after.png) |
| CHK-CONSOLE-01 | fail | 364 error-level console entries for 429 quiz submissions. | [console](console.log), [network](network.log) |
| CHK-A11Y-01 | pass | Headings, names, lang/dir, image alt, textual feedback all OK. | [quiz](screenshots/step-03-quiz-first-question.png), [feedback](screenshots/step-04-correct-feedback.png) |
| CHK-COPY-RTL-01 | pass | Hebrew Home/Quiz/TabBar copy without direction breakage. | [dashboard](screenshots/step-02-dashboard-before.png), [final](screenshots/step-06-quiz-final.png) |

## F-001: Stop quiz completion when answer submissions are rejected

- Severity: major
- Confidence: high
- Category: data
- Related checks: CHK-QUIZ-03, CHK-CONSOLE-01

Reproduction:

1. Open an authenticated topic quiz (traffic-laws, 501 questions).
2. Confirm answers at ~1 per second.
3. Observe 429 responses on POST `/api/quiz`.
4. Finish the quiz and return to the dashboard.

Expected: rejected submissions block completion until all answers are accepted.

Actual: 364 submissions returned 429, but final screen showed 122/501, progress saved (200), dashboard shows 501/501 answered.

Evidence: [network log](network.log), [console log](console.log), [final screen](screenshots/step-06-quiz-final.png), [dashboard after](screenshots/step-07-dashboard-after.png).

## NOT tested

- Push notifications / service worker
- Arabic locale
- Email OTP send path (auth is minted)
- Flashcards, schedule, videos, resources, credits, more pages
- Desktop viewport
- Exploration budget (double-click, browser back mid-quiz, reload mid-quiz)

## Known issues observed

None declared in charter.

## Limitations

- Quiz auto-answered with 900ms pacing; rate limits still triggered.
- Exploration budget skipped due to long quiz duration.
