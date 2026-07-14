---
id: "012-desktop-viewport"
title: "Desktop viewport sweep: layout, navigation, and core flows at 1440x900"
flow: "Dashboard → one quiz question → review → flashcards → schedule → more, all at a desktop viewport, watching layout and navigation"
persona: >
  Hebrew-speaking learner studying at a desk the evening before the exam,
  using the app in a desktop browser for the first time after days on the
  phone. Expects everything they know from mobile to work, read well, and
  not look like a stretched phone app with broken or unreachable controls.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 1440, height: 900 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB: 1273 questions, 277 signs, seeded topics; test-user progress may exist from earlier runs (this charter checks rendering, not data)"
timebox_minutes: 25
out_of_scope:
  - "Flow logic and persistence (covered by 001-005 on mobile; this run checks rendering and usability at desktop width)"
  - "Arabic locale at desktop (007 covers Arabic on mobile)"
  - "Exam simulation full run (003) — only its landing layout is swept"
  - "Responsive breakpoints other than 1440x900 (tablet widths are a possible follow-up)"
  - "Hover-only affordances audit (spot-checked, not exhaustive)"
known_issues: []
checks:
  - id: CHK-DESK-01
    desc: "No horizontal overflow on any swept page"
    oracle: "On /he, a topic quiz, review, /he/flashcards, /he/schedule, /he/exam and /he/more: document.scrollingElement.scrollWidth <= window.innerWidth and no horizontal scrollbar appears"
  - id: CHK-DESK-02
    desc: "Content is width-constrained, not stretched edge to edge"
    oracle: "Main content on each swept page renders in a readable centered column (a max-width container); text lines do not span the full 1440px viewport"
  - id: CHK-DESK-03
    desc: "Primary navigation is present and functional at desktop width"
    oracle: "The tab bar (or its desktop equivalent) is visible without scrolling on every swept page; each of its 5 destinations navigates correctly when clicked"
  - id: CHK-DESK-04
    desc: "Quiz is fully usable with a mouse at desktop width"
    oracle: "On a topic quiz: options are clickable, selection state renders, #quiz-next enables and confirms, feedback and the reward strip are visible without scrolling past the fold on 1440x900"
  - id: CHK-DESK-05
    desc: "Interactive targets do not overlap or collapse"
    oracle: "On the swept pages, buttons/links do not visually overlap, truncate their labels, or render at zero size (spot-check via bounding boxes on the quiz options, day picker, scope toggle, and tab bar)"
  - id: CHK-DESK-06
    desc: "Images scale sanely at desktop width"
    oracle: "Question/sign images on quiz and flashcards render within their cards at natural proportions (no stretching to container width, no overflow, no upscaled blur filling the column)"
  - id: CHK-DESK-07
    desc: "Keyboard operation works for the quiz answer loop"
    oracle: "Tab reaches the quiz options and #quiz-next in a sensible order with a visible focus indicator; Enter/Space activates them (desktop users are far likelier to use a keyboard)"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the sweep"
    oracle: "Browser console contains zero error-level entries across all swept pages (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics hold at desktop width"
    oracle: "Headings, landmarks, and accessible names are unchanged from mobile; focus indicator is visible at desktop zoom; html lang/dir correct"
  - id: CHK-COPY-RTL-01
    desc: "RTL layout does not break at desktop width"
    oracle: "Layout directions remain RTL-correct at 1440px (nav order, text alignment, back-link chevrons); no LTR-flipped sections or mirrored icons that read wrong"
exploration_budget: "After all checks, up to 5 min within scope: resize the window live from 1440 down to 390 and back (reflow sanity), browser zoom 150%, a very long topic name/label under desktop typography"
---

## Narrative

You know this app from your phone; tonight you are at a desk. Walk the familiar
surfaces and judge one thing per screen: does this read and operate like it was meant
for a big screen, or like a phone layout stretched wide? Do a single honest quiz
question with the mouse and once with the keyboard - desktop users tab and press
Enter, and that path never gets exercised on touch.

This charter is about rendering and usability, not logic: every flow it touches is
already covered by its own mobile charter. If data looks wrong, note it and move on -
unless the desktop layout itself caused it.

Route hints:

- Sweep order: `/he` (dashboard) → `/he/topics/<first-topic>` (one question:
  select, confirm, read feedback) → its `/review` → `/he/flashcards` (flip one card)
  → `/he/schedule` → `/he/exam` (landing only) → `/he/more`.
- Overflow oracle from the console:
  `document.scrollingElement.scrollWidth <= window.innerWidth`.
- Bounding-box spot checks: quiz `.quiz-option` buttons, schedule `.day-btn` row,
  review scope toggle, tab bar links.
- Meaningful-step screenshots: every swept page full-viewport, plus one closeup of
  the quiz feedback area and one of the tab bar region.

Severity rubric: blocker / major / minor / cosmetic / question - see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product
decision, file it as `question`, not `minor`.
