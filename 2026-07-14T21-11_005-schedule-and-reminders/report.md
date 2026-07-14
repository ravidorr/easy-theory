# QA report: Weekly study schedule

Run: `2026-07-14T21-11_005-schedule-and-reminders`

Charter: `qa/charters/005-schedule-and-reminders.md`

## Environment

- Git SHA: `cd095d1a60cee1421a6faac16f49b51a18218cff`
- App version: `0.3.130`
- Base URL: `http://localhost:3100`
- Viewport: `390x844`
- Locale: `he`
- Supabase host: `nvgqczaesfeotijjcbed.supabase.co`

## Verdict summary

8/9 pass, 1 fail (major finding on notify-on save), 0 blocked, 0 not-checked.

## Checks

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-SCHED-01 | pass | Pickers rendered with sane defaults. | [initial](screenshots/step-01-schedule-initial.png) |
| CHK-SCHED-02 | pass | Day toggles updated labels and summary. | [selected](screenshots/step-02-schedule-selected.png) |
| CHK-SCHED-03 | pass | Time/duration reflected in summary. | [selected](screenshots/step-02-schedule-selected.png) |
| CHK-SCHED-04 | pass | Save PUT succeeded and redirected home. | [network](network.log) |
| CHK-SCHED-05 | pass | Saved values round-tripped on reopen. | [persisted](screenshots/step-03-schedule-persisted.png) |
| CHK-SCHED-06 | fail | Notify-on save hung on permission prompt. | [network](network.log) |
| CHK-CONSOLE-01 | pass | No console errors. | [console](console.log) |
| CHK-A11Y-01 | pass | Pressed states, labeled time input, heading. | [initial](screenshots/step-01-schedule-initial.png) |
| CHK-COPY-RTL-01 | pass | Hebrew copy RTL intact. | [selected](screenshots/step-02-schedule-selected.png) |

## F-001: Schedule save hangs when reminders are on

- Severity: major
- Confidence: medium
- Category: functional

Reproduction: enable notify toggle, save schedule in automated browser.

Expected: Save completes even if push permission unavailable.

Actual: Button stuck on שומרים... awaiting Notification.requestPermission.

Evidence: [network log](network.log).

## NOT tested

Push delivery, cron notify, email fallback, SW push (011), Arabic (007), desktop.

## Limitations

Automated browser permission prompt behavior; redirect inferred from network.
