---
id: "005-schedule-and-reminders"
title: "Weekly study schedule: pick, save, persist, notify toggle"
flow: "Open schedule → pick days/time/duration → live summary updates → save → success toast on More → reopen schedule and verify persistence"
persona: >
  Hebrew-speaking learner who keeps postponing study sessions and wants the
  app to hold them to a routine: two fixed evenings a week with a reminder.
  Expects what they saved to still be there tomorrow.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB; the test user may already have a saved schedule from earlier runs (the run overwrites it and compares within-run)"
timebox_minutes: 20
out_of_scope:
  - "Actual push delivery and /api/cron/notify (not browser-reachable)"
  - "Email reminder fallback (Resend key is a dummy in QA)"
  - "Service-worker push event handling (011)"
  - "Arabic locale (007)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-SCHED-01
    desc: "Schedule page renders pickers with a sane initial state"
    oracle: "/he/schedule shows #day-picker with 7 .day-btn, #time-input, #duration-picker with 30/45/60 .duration-btn options, #notify-toggle, and #save-schedule-btn; any previously saved schedule is pre-selected"
  - id: CHK-SCHED-02
    desc: "Day selection toggles and is reflected in the summary"
    oracle: "Tapping a .day-btn toggles data-selected; #days-label and #summary-text update to name the selected days (no stale or empty summary while days are selected)"
  - id: CHK-SCHED-03
    desc: "Time and duration selections update the summary"
    oracle: "Changing #time-input and picking a .duration-btn are reflected in #summary-text; exactly one duration is active at a time"
  - id: CHK-SCHED-04
    desc: "Saving persists the schedule and returns to More with confirmation"
    oracle: "#save-schedule-btn triggers PUT /api/schedule with 2xx, shows the localized success toast, and lands on /he/more after the brief confirmation delay"
  - id: CHK-SCHED-05
    desc: "The saved schedule round-trips"
    oracle: "Reopening /he/schedule shows exactly the days, time, and duration saved in CHK-SCHED-04 (served via GET /api/schedule)"
  - id: CHK-SCHED-06
    desc: "Notify toggle behaves gracefully without push permission"
    oracle: "Toggling #notify-toggle updates aria-checked; if the browser cannot grant push permission, saving still succeeds and no unhandled error or broken state appears (the subscribe POST itself may be blocked — report as blocked, not fail)"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case; a push-permission denial must be handled, not thrown)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on the schedule page"
    oracle: "Day and duration buttons expose pressed/selected state to AT (not color-only); #notify-toggle has a role and aria-checked; #time-input is labeled; a heading exists"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (Schedule/JS.Schedule namespaces); no raw keys; day names and the HH:MM time render without direction breakage"
exploration_budget: "After all checks, up to 5 min within scope: save with zero days selected, deselect everything after having a saved schedule, rapid toggling of days before save, double-click save"
---

## Narrative

You are setting up your study routine: pick Sunday and Wednesday at 19:30 for
45 minutes, turn on reminders, and save. Then act like it is the next day — come back
to the page and make sure the app remembered. Change one thing (say, add Thursday)
and save again to prove updates replace cleanly rather than duplicating.

Route hints:

- Page `/he/schedule`, driven by `public/js/schedule.js` (+ `public/js/push.js` for
  the notify toggle via `window.pushHelpers`).
- Hooks: `#day-picker`/`.day-btn[data-selected]`, `#time-input`,
  `#duration-picker`/`.duration-btn`, `#notify-toggle`, `#days-label`,
  `#summary-text`, `#save-schedule-btn`.
- API: GET `/api/schedule` populates, PUT `/api/schedule` replaces atomically; on
  success the script shows a toast then navigates to `/<locale>/more`. Server validates
  days 0-6 and HH:MM.
- Push: the toggle asks for browser notification permission and POSTs
  `/api/push/subscribe`. In an automated browser, permission is often unavailable —
  that path earns a `blocked` verdict with the observed behavior, never a silent pass.
- Copy sources: `messages/he.json`, namespaces `Schedule`, `JS.Schedule`.
- Meaningful-step screenshots: initial state, days+time+duration selected with summary,
  save confirmation toast and post-save More page, reopened schedule showing persisted values, notify-toggle
  state.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
