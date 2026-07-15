# QA Run: 005-schedule-and-reminders

**Run ID:** `2026-07-15T17-46_005-schedule-and-reminders`  
**Verdict summary:** 7/9 pass, 1 fail (major), 1 blocked, 0 not-checked

## Finding F-001: Schedule save hangs without redirect when notify toggle is on

**Severity:** major | **Confidence:** medium

Save with notify enabled left the page on /he/schedule with a disabled שומרים... button; schedule data persisted but oracle redirect to /he did not occur.

Evidence: screenshots/step-03-schedule-persisted.png

## NOT tested

Push delivery, exploration budget, out_of_scope items.
