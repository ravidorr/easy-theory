# QA report: mistake review + retry session

Run: `2026-07-14T20-36_002-review-and-retry`

Charter: `qa/charters/002-review-and-retry.md`

## Verdict summary

10/10 pass, 0 fail, 0 blocked, 0 not-checked.

## Checks

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-REVIEW-01 | pass | Last-session mistakes listed with wrong/correct labels | [review](screenshots/step-05-review-last-session.png) |
| CHK-REVIEW-02 | pass | Scope toggle works; all-time superset | [last](screenshots/step-05-review-last-session.png), [all](screenshots/step-06-review-all-time.png) |
| CHK-REVIEW-03 | pass | Empty state with localized copy | [empty](screenshots/step-02-review-empty-state.png) |
| CHK-RETRY-01 | pass | Retry mode, 234 questions | [retry](screenshots/step-07-retry-first-question.png) |
| CHK-RETRY-02 | pass | Quiz POSTs only; no progress; no resume key | [network](network.log), [final](screenshots/step-08-retry-final.png) |
| CHK-RETRY-03 | pass | Safety stayed 305/305 after retry | [dashboard](screenshots/step-09-dashboard-after-retry.png) |
| CHK-RETRY-04 | pass | Vehicle retry redirected to review | [redirect](screenshots/step-01-retry-redirect-to-review.png) |
| CHK-CONSOLE-01 | pass | No console errors | [console](console.log) |
| CHK-A11Y-01 | pass | Scope group, aria-current, textual labels | [review](screenshots/step-05-review-last-session.png) |
| CHK-COPY-RTL-01 | pass | Hebrew Review/Retry copy OK | [review](screenshots/step-05-review-last-session.png) |

## NOT tested

- Exploration budget probes
- Arabic locale, exam review, desktop viewport

## Limitations

- Full 305-question setup quiz (session recording requirement)
