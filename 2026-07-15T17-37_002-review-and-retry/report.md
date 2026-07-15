# QA Run: 002-review-and-retry

**Run ID:** `2026-07-15T17-37_002-review-and-retry`  
**Charter:** `qa/charters/002-review-and-retry.md`  
**Verdict summary:** 8/10 pass, 0 fail, 2 blocked, 0 not-checked

## Environment

| Field | Value |
|-------|-------|
| base_url | http://localhost:3100 |
| git_sha | 172d979df3635ffe402dc96c524ee32122e05c2f |
| app_version | 0.3.141 |
| supabase_host | nvgqczaesfeotijjcbed.supabase.co |
| viewport | 390x844 |
| locale | he |

## Checks matrix

| Check | Verdict | Observed | Evidence |
|-------|---------|----------|----------|
| CHK-REVIEW-01 | pass | Last-session review lists 22 wrong rows with question, wrong pick, and correct answer labels | screenshots/step-04-review-last-session.png |
| CHK-REVIEW-02 | pass | Scope toggle active state and all-time superset (23 vs 22) | step-04, step-05 |
| CHK-REVIEW-03 | blocked | No topic with zero last-session mistakes in seeded user | — |
| CHK-RETRY-01 | pass | Retry mode with total=22 matching review count | step-08 |
| CHK-RETRY-02 | pass | /api/quiz 200, no /api/progress, resume key unchanged | step-08, network.log |
| CHK-RETRY-03 | pass | Dashboard vehicle progress 34% unchanged before/after retry | step-07, step-09 |
| CHK-RETRY-04 | blocked | All topics have last-session mistakes; redirect not observable | — |
| CHK-CONSOLE-01 | pass | No console errors | console.log |
| CHK-A11Y-01 | pass | aria-current, text labels for correct/wrong, headings, image alt | step-04 |
| CHK-COPY-RTL-01 | pass | Hebrew copy from he.json, no raw keys | step-04, step-08 |

## Findings

No new findings.

## NOT tested

- Quiz mechanics beyond setup (001)
- Arabic locale review/retry (007)
- Exam-result review (003)
- Desktop viewport
- Review empty state (blocked)
- Retry redirect with no mistakes (blocked)
- Full retry completion screen (only 1/22 answered)
- Exploration budget items

## Known issues observed

None declared in charter.

## Limitations

- Prior auth session in browser; unauthed redirect not captured
- Seeded user in-progress session inflated last-session mistake count
- Empty-state and retry-redirect checks need session reset
