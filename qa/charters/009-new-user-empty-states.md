---
id: "009-new-user-empty-states"
title: "Brand-new user: every empty state, then first-answer initialization"
flow: "Mint a fresh user → home empty states → exam landing (no history) → review (no mistakes) → more (zero stats) → answer one question → counters initialize"
persona: >
  Hebrew-speaking learner who just signed up minutes ago. Has done nothing
  yet: no streak, no points, no attempts, no mistakes. Judges the app by
  whether it looks intentional and welcoming when empty, or broken.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-fresh-<run-ts>@clearroad.test"
    mint: "pnpm qa:mint --email qa-fresh-<run-ts>@clearroad.test"
  data_assumptions: "Seeded test DB (4 topics, 1273 questions, 277 signs); the minted user is auto-created and MUST be brand new — substitute a unique <run-ts> per run, never reuse an address"
timebox_minutes: 25
out_of_scope:
  - "Deep flow mechanics (001-005) — this run checks zero-state rendering and first-write initialization only"
  - "Signup/login UX (008)"
  - "Arabic locale (007)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-EMPTY-01
    desc: "Home renders clean zero-value pills for a fresh user"
    oracle: "/he shows streak and star points as 0 (or an intentional empty treatment) — never NaN, undefined, null, or a blank pill"
  - id: CHK-EMPTY-02
    desc: "All topics show the not-started state"
    oracle: "All 4 seeded topics render with not-started status and zero progress; the completed counter reads 0 / 4"
  - id: CHK-EMPTY-03
    desc: "Conditional home sections handle no-data"
    oracle: "No weak-topics section appears (requires answer history); the readiness card shows its empty state inviting a first exam, not a bogus score"
  - id: CHK-EMPTY-04
    desc: "Exam landing shows an empty history"
    oracle: "/he/exam renders the rules and start button with an intentional empty-history treatment; no phantom best score"
  - id: CHK-EMPTY-05
    desc: "Review page for an untouched topic shows its empty state"
    oracle: "/he/topics/<slug>/review renders the localized no-mistakes empty state (both scopes); /he/topics/<slug>/retry redirects to review instead of opening an empty quiz"
  - id: CHK-EMPTY-06
    desc: "More page zero states are intentional"
    oracle: "/he/more stats show zeros matching home; the medals grid shows all medals unearned (or its empty treatment) without layout breakage"
  - id: CHK-INIT-01
    desc: "First correct answer initializes streak and points"
    oracle: "After confirming one correct answer in any topic quiz, POST /api/quiz returns 2xx with streak_days=1 and star_points=10; the dashboard pills reflect 1 and 10 afterwards"
  - id: CHK-INIT-02
    desc: "First activity flips the topic out of not-started"
    oracle: "After the first answered question (and leaving the quiz), the topic no longer shows the pristine not-started zero state on the dashboard"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps — empty data must never produce errors (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics across the empty states"
    oracle: "Empty-state messages are real text (not aria-hidden decoration); buttons/links have accessible names; a heading exists per page; html lang/dir correct"
  - id: CHK-COPY-RTL-01
    desc: "Empty-state copy is localized and unbroken"
    oracle: "All empty-state strings exist in he.json; no raw keys, placeholder lorem, or direction breakage in zero-value displays"
exploration_budget: "After all checks, up to 5 min within scope: /he/flashcards and /he/schedule as the fresh user (sane defaults?), reload home between CHK-EMPTY and CHK-INIT phases, a second fresh user to confirm reproducibility"
---

## Narrative

First morning with the app. Wander the way a curious new user would — home, the exam
tab, a topic, More — and judge every screen by one question: does "nothing yet" look
designed, or does it look like a bug? Zero states are where NaN, undefined, and
divide-by-zero artifacts hide.

Then do the smallest possible real action: answer exactly ONE question correctly in a
quiz. That single write should initialize the whole counters pipeline (streak 1,
points 10) — the moment where empty-state code hands over to real-data code is a
classic breakage point. Keep it to one answer so the before/after is unambiguous.

Freshness is the whole charter: mint with a UNIQUE email
(`pnpm qa:mint --email qa-fresh-<run-ts>@clearroad.test`, substituting a timestamp).
In preflight, verify the pills actually show zero — if they do not, the user is not
fresh; mint another rather than reporting false findings.

Route hints:

- Empty-state sources: home page (pills, weak topics, readiness card), `/he/exam`
  history, `/he/topics/<slug>/review` (both scopes), `/he/more` stats + medals.
- Initialization constants (`src/lib/quiz.ts`): 10 points per correct answer, streak
  milestones at 3/7/14/30 (so one answer earns no medal — none should appear).
- Copy sources: `messages/he.json`, namespaces `Home`, `Exam`, `Review`, `More`.
- Meaningful-step screenshots: fresh home, readiness empty card, exam empty history,
  review empty state, More zero stats/medals, the one answered question, home after
  with streak 1 / points 10.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
