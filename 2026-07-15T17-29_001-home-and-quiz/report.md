# QA run: 001-home-and-quiz

**Verdict:** 13/14 pass, 0 fail, 1 blocked, 0 not-checked

## Environment

| Field | Value |
| --- | --- |
| base_url | http://localhost:3100 |
| git_sha | 172d979df3635ffe402dc96c524ee32122e05c2f |
| app_version | 0.3.141 |
| supabase_host | nvgqczaesfeotijjcbed.supabase.co |
| viewport | 390x844 |
| locale | he |

## Checks matrix

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-AUTH-01 | pass | Unauthed / → /he/auth/login with email form | step-01-login-redirect.png |
| CHK-AUTH-02 | pass | Minted session on /he dashboard | step-02-dashboard.png |
| CHK-HOME-01 | pass | Streak 3, score 3010, four topics with progress | step-02-dashboard.png |
| CHK-HOME-02 | pass | Hebrew RTL, no raw keys, dir=rtl lang=he | step-02-dashboard.png |
| CHK-QUIZ-01 | pass | Quiz loaded with 4 options at 7/106 | step-03-quiz-question.png |
| CHK-QUIZ-02 | pass | Select/confirm/feedback loop; counter advanced | step-04/05 |
| CHK-QUIZ-03 | pass | POST /api/quiz 200 on each answer | network.log |
| CHK-QUIZ-04 | blocked | Final UI on traffic-laws; POST /api/progress not triggered | step-06-quiz-final.png |
| CHK-QUIZ-05 | pass | Vehicle 6/106 → 28/106; score 3010 → 3060 | step-02, step-07 |
| CHK-QUIZ-06 | pass | Cleared localStorage; resumed at 9/106 not 1 | step-09-cross-browser-resume.png |
| CHK-QUIZ-07 | pass | Reload mid-quiz restored question 9 via localStorage | step-08-quiz-resume-reload.png |
| CHK-CONSOLE-01 | pass | Zero console errors | console.log |
| CHK-A11Y-01 | pass | Headings, alt text, SR feedback on answers | step-04/05 |
| CHK-COPY-RTL-01 | pass | Hebrew copy, RTL intact | step-02, step-03 |

## Findings

None.

## NOT tested

- Push notifications / service worker
- Arabic locale
- Email OTP send-otp path
- Flashcards, schedule, videos, resources, credits, more pages
- Desktop viewport
- POST /api/progress on live quiz completion (vehicle topic has 78 questions remaining)

## Known issues observed

None declared in charter.

## Limitations

Test user had existing progress. Full vehicle-topic completion was not feasible within the timebox.

## Next charter suggestions

Run 002-review-and-retry on traffic-laws review flow; consider resetting vehicle topic progress for cleaner CHK-QUIZ-04 coverage.
