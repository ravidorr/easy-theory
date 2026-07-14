# QA run 2026-07-14T18-05_001-home-and-quiz

Charter: `qa/charters/001-home-and-quiz.md` — Authed home dashboard + topic quiz practice flow

## Environment

| | |
| --- | --- |
| base_url | <http://localhost:3100> |
| git_sha | `d058ff774639a64e7ecc323f8bcdae151b675da2` |
| app_version | 0.3.119 |
| supabase_host | nvgqczaesfeotijjcbed.supabase.co (QA project) |
| viewport | 390x844 |
| locale | he |

## Verdict summary

**11/12 pass, 0 fail, 1 blocked (quiz-completion path), 0 not-checked — 1 finding (question severity).**

## Checks matrix

| Check | Verdict | Observed | Evidence |
| --- | --- | --- | --- |
| CHK-AUTH-01 | pass | Unauthed `/` → `/he/auth/login`, email form visible | screenshots/step-01-login-redirect.png |
| CHK-AUTH-02 | pass | Minted session landed on `/he`, widgets render, no loop | screenshots/step-02-dashboard.png |
| CHK-HOME-01 | pass | Streak 2, points 320, 4 seeded topics with real counts | screenshots/step-02-dashboard.png |
| CHK-HOME-02 | pass | `lang=he dir=rtl`; labels match `Home` namespace; no raw keys | screenshots/step-02-dashboard.png |
| CHK-QUIZ-01 | pass | Quiz loaded question 1/501 with 4 option buttons | screenshots/step-03-quiz-first-question.png |
| CHK-QUIZ-02 | pass | Select→confirm→feedback loop works; counter advanced 1→2→3 | screenshots/step-04-correct-feedback.png, screenshots/step-05-wrong-feedback.png |
| CHK-QUIZ-03 | pass | 3 confirmed answers → 3× POST `/api/quiz` 200 | network.log |
| CHK-QUIZ-04 | blocked | Session spans all 501 questions; `#quiz-final` unreachable in timebox | — |
| CHK-QUIZ-05 | pass | Points 320→340, topic 2/501→3/501, daily chip ✓ | screenshots/step-02-dashboard.png, screenshots/step-07-dashboard-after.png |
| CHK-CONSOLE-01 | pass | 0 error-level entries; only dev-mode preload/LCP warnings | console.log |
| CHK-A11Y-01 | pass | Accessible names, headings, `aria-pressed`, sr-only result text | screenshots/step-04-correct-feedback.png, screenshots/step-05-wrong-feedback.png |
| CHK-COPY-RTL-01 | pass | Strings match he.json; no leakage or direction breakage | screenshots/step-02-dashboard.png, screenshots/step-03-quiz-first-question.png |

## Findings

### F-001 — [question] Quiz restarts from question 1 in a new browser despite server-side progress and "continue where you stopped" copy

- **Severity:** question · **Confidence:** medium · **Category:** functional · **Related:** CHK-QUIZ-01, CHK-QUIZ-05

**Repro steps:**

1. Have a user with existing progress in a topic (dashboard shows "חוקי התנועה 2/501 שאלות"; the daily-task card promises "אפשר להמשיך מאיפה שעצרת")
2. Open the app in a fresh browser/device (empty localStorage) and log in
3. Tap the suggested-topic CTA to open `/he/topics/traffic-laws`

**Expected:** the quiz resumes after the already-answered questions, consistent with the server-side 2/501 count and the "continue where you stopped" promise.

**Actual:** the quiz opened at "1 מתוך 501" and re-served already-answered questions. Quiz position lives only in browser localStorage — within-browser reload resumes correctly (verified, step-06), but position does not follow the account across browsers/devices while the answered-count does.

**Evidence:** screenshots/step-02-dashboard.png, screenshots/step-03-quiz-first-question.png, screenshots/step-06-reload-restores-state.png

**Notes:** filed as `question` — client-local resume may be an intentional pilot simplification, but the dashboard copy promises continuation and the server already knows which questions were answered.

## NOT tested

- Push notifications / service worker (out_of_scope)
- Arabic locale (out_of_scope)
- Email sending / send-otp path — auth was minted (out_of_scope)
- Flashcards / schedule / videos / resources / credits / more pages (out_of_scope)
- Desktop viewport (out_of_scope)
- Quiz completion: `#quiz-final` + POST `/api/progress` (CHK-QUIZ-04 blocked)
- Exploration probes: rapid double-click on confirm, browser back mid-quiz, empty-progress persona
- Sign-image questions (the 3 questions served were text-only)

## Known issues observed

None declared in the charter; none matched.

## Limitations and next-charter suggestions

- Only 3 of 501 traffic-laws questions were answered — the loop was validated, not the full session.
- F-001 cross-browser behavior observed once (fresh profile vs seeded server progress); within-browser resume verified via reload.
- The run mutated the QA test user's data (3 quiz responses, +20 points) — expected; `qa/SETUP.md` has a reset snippet.
- Suggestion: a short seeded topic or a batched quiz mode would make the completion path (CHK-QUIZ-04) testable end-to-end.
