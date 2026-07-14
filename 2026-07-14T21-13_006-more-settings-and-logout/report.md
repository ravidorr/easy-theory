# QA report: More hub settings and logout

Run: `2026-07-14T21-13_006-more-settings-and-logout`

## Verdict summary

9/9 pass, 0 fail, 0 blocked, 0 not-checked.

## Checks

| Check | Verdict | Evidence |
| --- | --- | --- |
| CHK-MORE-01 | pass | [home](screenshots/step-01-home-stats.png), [more](screenshots/step-02-more-page.png) |
| CHK-MORE-02 | pass | [more](screenshots/step-02-more-page.png) |
| CHK-MORE-03 | pass | [more](screenshots/step-02-more-page.png) |
| CHK-MORE-04 | pass | [light](screenshots/step-03-light-theme.png) |
| CHK-MORE-05 | pass | [ar](screenshots/step-04-ar-more.png) |
| CHK-MORE-06 | pass | [login](screenshots/step-05-login-after-logout.png) |
| CHK-CONSOLE-01 | pass | [console](console.log) |
| CHK-A11Y-01 | pass | [more](screenshots/step-02-more-page.png) |
| CHK-COPY-RTL-01 | pass | [more](screenshots/step-02-more-page.png) |

## NOT tested

Full Arabic sweep (007), medal earning, desktop.

## Limitations

Logout UI click required fetch fallback in automation.
