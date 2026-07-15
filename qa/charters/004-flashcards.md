---
id: "004-flashcards"
title: "Sign flashcards: flip, know/don't-know, unknown replay"
flow: "Open flashcards → flip cards → mark a mix of know/don't-know → verify progress counters → verify don't-know cards replay at the end"
persona: >
  Hebrew-speaking learner memorizing road signs on the bus. Expects fast,
  offline-feeling card flips, honest progress counters, and that cards
  they didn't know come back around until learned.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB: 277 signs with images under /signs/; flashcards page loads all of them into #fc-data; migration 014 adds user_srs_cards for persisted SM-2 grades"
timebox_minutes: 20
out_of_scope:
  - "Completing all 277 cards (sample + replay proof only)"
  - "Sign questions inside quizzes (001) and sign images elsewhere"
  - "Arabic locale (007)"
  - "Offline behavior of cached sign images (011)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-FC-01
    desc: "Flashcards page loads the full seeded sign deck"
    oracle: "/he/flashcards renders #flashcards-container; #fc-data JSON parses and contains 277 signs; the first card shows a sign image from /signs/ and #fc-count reflects the deck size"
  - id: CHK-FC-02
    desc: "Tapping a card flips it to reveal the sign name"
    oracle: "Tap toggles .flipped on .flashcard-inner; the back shows the sign name (#fc-name) and badge (#fc-badge) matching the current card's #fc-data entry"
  - id: CHK-FC-03
    desc: "Know / don't-know advance the deck and update progress"
    oracle: "#fc-yes and #fc-no each advance to the next card; #fc-count and #fc-progress update accordingly and never show NaN/undefined"
  - id: CHK-FC-04
    desc: "Don't-know cards replay after the first pass"
    oracle: "Cards marked with #fc-no reappear at the end of the pass (verify by marking a small identifiable set within a bounded sample); cards marked known do not reappear"
  - id: CHK-FC-05
    desc: "Each first-time grade persists to SRS without blocking the deck"
    oracle: "First know/don't-know on a card fires exactly one POST /api/srs with sign_id and knew; in-session replays of don't-know cards do not re-post; failed saves do not block deck advancement (static /signs/ image fetches are expected)"
  - id: CHK-FC-06
    desc: "A broken image path falls back to the placeholder"
    oracle: "All sampled cards render an image (no broken-image icon); if any sign image 404s, the placeholder renders instead of a broken layout"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on the flashcards page"
    oracle: "The card is operable via an accessible control (not a bare div with no role/name); sign images have alt text; #fc-yes/#fc-no have accessible names; a heading exists; know/don't-know state is not color-only"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (Flashcards/JS.Flashcard namespaces); no raw keys; Hebrew sign names render RTL without breakage"
exploration_budget: "After all checks, up to 5 min within scope: rapid double-tap on the card (flip jitter), tapping yes/no before flipping, reload mid-deck (state reset expected?), marking every sampled card don't-know"
---

## Narrative

You are drilling signs in spare minutes. Work a bounded sample honestly: flip the
card, decide, mark it. Mark a small set you can recognize later (note their sign
names/badges) as don't-know — those must come back at the end of the pass; that
replay loop is the core promise of the feature.

Since the deck is 277 cards, do NOT try to finish it. A practical approach: mark
"don't know" on the first 3 cards, "know" on the next ~7, then keep marking "know"
until the replay begins, and verify the 3 unknowns return in order.

Route hints:

- Page `/he/flashcards`, driven by `public/js/flashcard.js`. The server renders card 0
  and embeds the whole deck as JSON in `#fc-data`.
- Hooks: `#flashcards-container`, `.flashcard-wrap`/`.flashcard-inner` (`.flipped`),
  `#fc-name`, `#fc-badge`, `#fc-count`, `#fc-progress`, `#fc-yes`, `#fc-no`.
- SRS persistence: each card's first know/don't-know grade POSTs to `/api/srs`
  (fire-and-forget SM-2 save via migration `014_srs_cards.sql`); in-session replays
  are not re-graded. Image srcs are validated same-origin with a placeholder fallback
  (`/placeholder.svg`).
- Copy sources: `messages/he.json`, namespaces `Flashcards`, `JS.Flashcard`.
- Meaningful-step screenshots: first card front, same card flipped, progress mid-pass,
  first replayed don't-know card, deck-complete state (if reached within the sample).

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
