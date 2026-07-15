# QA Run: 003-exam-simulation

**Run ID:** `2026-07-15T17-42_003-exam-simulation`  
**Verdict summary:** 10/11 pass, 0 fail, 0 blocked, 1 not-checked

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
| CHK-EXAM-01 | pass | Rules, start, history on landing | step-01 |
| CHK-EXAM-02 | pass | 30 questions, no answer leakage | step-02 |
| CHK-EXAM-03 | not-checked | Prev/next with selections not exercised | — |
| CHK-EXAM-04 | pass | Timer counts down | step-02 |
| CHK-EXAM-05 | pass | Unanswered submit confirm dialog | step-02 |
| CHK-EXAM-06 | pass | Server-scored result 0/30 fail | step-03 |
| CHK-EXAM-07 | pass | New attempt in history, best=1 | step-04 |
| CHK-EXAM-08 | pass | Readiness card 5%, no NaN | step-05 |
| CHK-CONSOLE-01 | pass | No errors | console.log |
| CHK-A11Y-01 | pass | Text timer/counter, headings | step-01, step-02 |
| CHK-COPY-RTL-01 | pass | Hebrew copy OK | step-01, step-03 |

## Findings

None.

## NOT tested

See findings.json not_tested.

## Limitations

Exam submitted with zero answers before navigation testing.
