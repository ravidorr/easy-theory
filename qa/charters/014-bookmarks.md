---
id: "014-bookmarks"
title: "Saved questions: bookmark from study, browse, and remove"
flow: "Bookmark a quiz question → verify review control → open More → browse saved questions → remove bookmark → verify empty state"
persona: >
  Hebrew-speaking learner who wants to set aside confusing questions for a later
  review session. Expects the saved list to survive navigation and a second tab,
  and expects removing a saved question to take effect everywhere.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "isolated qa-bookmarks-<run-id>@clearroad.test"
    mint: "pnpm qa:mint --email qa-bookmarks-<run-id>@clearroad.test"
  data_assumptions: "Seeded test DB: 1273 questions, 277 signs, and migration 013 user_question_bookmarks applied; use a new isolated QA user so its bookmark list starts empty"
timebox_minutes: 20
out_of_scope:
  - "Practice quiz answer/feedback mechanics beyond reaching a bookmark control (001)"
  - "Mistake-review correctness and retry mechanics beyond its bookmark control (002)"
  - "Arabic content and locale switching (007)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-BOOKMARK-01
    desc: "Quiz and review expose an accessible bookmark control"
    oracle: "A question on `/he/topics/<slug>` and a question on `/he/topics/<slug>/review` each expose `.bookmark-toggle` with a question id, accessible label, and `aria-pressed` state; the current saved state is represented consistently after navigation"
  - id: CHK-BOOKMARK-02
    desc: "Bookmarking persists with idempotent set-state writes"
    oracle: "Setting a question to bookmarked sends one successful PUT `/api/bookmarks` with its `question_id` and `bookmarked: true`; its control remains pressed after reload or a fresh tab. A rapid repeated click does not produce a wrong final state or duplicate visible entry"
  - id: CHK-BOOKMARK-03
    desc: "More navigation leads to the saved-question list"
    oracle: "The Bookmarks row on `/he/more` opens `/he/bookmarks`; the list includes the saved question's text, correct option, and explanation when available, with its bookmark control pressed"
  - id: CHK-BOOKMARK-04
    desc: "Removing a saved question propagates and restores the empty state"
    oracle: "Setting the bookmark control to off sends successful PUT `/api/bookmarks` with `bookmarked: false`; after reload the question is absent from `/he/bookmarks`, its source control is unpressed, and when the isolated run user's list is empty the localized empty state and back-home link render"
  - id: CHK-BOOKMARK-05
    desc: "Bookmark failures preserve the prior visual state"
    oracle: "If a PUT `/api/bookmarks` request is forced to fail, the control rolls back to its prior `aria-pressed` state and a localized polite error is announced; no stale optimistic saved state remains"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the bookmark flow"
    oracle: "Browser console contains zero error-level entries across source pages, More, and the saved-question list; the intentionally forced failing request in CHK-BOOKMARK-05 must be handled without an unhandled exception"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on saved-question controls and list"
    oracle: "Every bookmark control has an accessible name and pressed state; state changes are announced on error; saved question cards have headings and correct-answer state is not color-only; html lang/dir remain correct"
  - id: CHK-COPY-RTL-01
    desc: "Bookmark copy is localized and direction-safe"
    oracle: "Visible strings come from he.json Bookmarks and Quiz namespaces; no raw keys, unexpected English, or RTL breakage around question text, signs, or option letters"
exploration_budget: "After all checks, up to 5 min within scope: bookmark several questions from different topics, remove one from its source page and one from the list, use browser back/forward, and reload during a pending write"
---

## Narrative

You find a question that deserves a second look, save it, and later return through
More to study the saved list. The feature is a persistent list, not a visual toggle:
the state must survive navigation and a fresh tab, and removal must be reflected at
the source and in the list. Mint a unique `qa-bookmarks-<run-id>@clearroad.test`
account for this run; do not use the shared `qa-user`, because the empty-state
assertion needs a known-empty bookmark list. Keep a note of the question text or id
selected so the cross-page assertion is unambiguous. Remove every bookmark created by
this run before finishing.

Route hints:

- Bookmark controls exist on practice quiz, retry, mistake-review, and bookmarks pages.
  They use `.bookmark-toggle[data-question-id]` and `aria-pressed`.
- `public/js/bookmark.js` writes idempotent set state with PUT `/api/bookmarks`:
  `{ question_id, bookmarked: boolean }`. A failed request must roll back the
  optimistic pressed state and announce the localized error.
- More has a `/he/bookmarks` row. The list page renders each saved question with the
  correct answer and explanation, where available; its empty state returns home.
- To force the write-failure check, use browser request blocking or response override
  for `/api/bookmarks`; restore network handling immediately afterwards.
- Copy sources: `messages/he.json`, namespaces `Bookmarks` and `Quiz`.
- Meaningful-step screenshots: source-page bookmark on, More Bookmarks row, populated
  saved-question list, failed-write rollback/error, removal, and final empty state.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
