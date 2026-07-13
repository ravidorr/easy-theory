# Agentic Exploratory QA — Pilot Framework

## Context

We want an agent that does exploratory QA on ClearRoad: smoke-test core flows, explore UI
states humans miss, catch obvious regressions (broken buttons, bad routing, blank states,
console errors, layout issues), validate copy/RTL/a11y basics, and produce clear repro
steps — as a **QA multiplier, not a replacement** for the existing Vitest suite. The #1
risk to design against is **false confidence** ("looks good" while missing a real issue,
or flagging subjective noise).

Before this framework the repo had zero e2e/browser infrastructure, no staging
environment (`.env.local` symlinks to the production Supabase env), and magic-link-only
auth. Decisions made:

1. **Environment**: local `pnpm dev` against a **dedicated test Supabase project** seeded
   from `seeds/` (known data, true isolation).
2. **Auth**: mint sessions for a seeded test user via Supabase admin `generateLink` — no
   product-code changes. `src/app/auth/callback/route.ts` already accepts
   `?token_hash=&type=` and calls `verifyOtp`, which is exactly what `generateLink`
   returns (`data.properties.hashed_token`).
3. **Scope**: pilot — framework + ONE charter (home dashboard + topic quiz flow)
   validated end-to-end.
4. **Trigger**: manual `/qa-explore <charter-path>` project skill. Human review gate: the
   agent **never** mutates GitHub (no issues/PRs/comments) — findings are local files
   only; humans file the issues.

## Grounding facts

- **Callback route** (`src/app/auth/callback/route.ts`): token-hash flow works without
  PKCE cookies; failure redirects to `/auth/login?error=1`. `/auth` paths are public in
  `src/proxy.ts`.
- **Routing oracles** (`src/proxy.ts`): unauthed `/` → `/he/auth/login`; authed `/` →
  `/he` dashboard.
- **Env precedence footgun**: Next.js never overrides vars already in `process.env`
  (shell wins over `.env.local`), but any var **missing** from the shell falls back to
  the production `.env.local`. So `.env.qa` must define ALL vars the app reads
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` real; `RESEND_API_KEY`, `CRON_SECRET`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL` dummies),
  and scripts guard against pointing at prod.
- **Quiz oracles** (`public/js/quiz.js`): POST `/api/quiz` per confirmed answer, POST
  `/api/progress` at quiz end; UI hooks `#quiz-container`, `#quiz-next`,
  `#quiz-progress-fill`, `#quiz-final`.
- Seeds order: `schema.sql` → `topics.sql` → `questions.sql` → `signs.sql` →
  `signs_names_patch.sql` → `rate_limits.sql` → `migrations/001…005`. Sanity: 1273
  questions, 277 signs.

## Layout

```text
qa/
  PLAN.md                           # this document
  SETUP.md                          # one-time env setup doc
  charters/TEMPLATE.md              # annotated charter template
  charters/001-home-and-quiz.md     # pilot charter
  schema/findings.schema.json       # report schema (documentation + validator reference)
  runs/                             # run artifacts — gitignored + markdownlint-ignored
scripts/qa/
  mint-session.ts                   # session mint + prod guards + --check seed sanity
  qa-dev.sh                         # QA dev server wrapper (port 3100) with guards
  validate-report.ts                # mechanical report-completeness gate
.claude/skills/qa-explore/SKILL.md  # the runner skill
.env.qa.example                     # committed template; real .env.qa stays gitignored
```

No new dependencies — the validator is hand-rolled; charter check IDs are extracted by
regex (`- id: CHK-*`), so no YAML parser is needed.

## Charter format

Markdown with YAML frontmatter. Frontmatter is the machine-checkable contract; the body
is narrative guidance for the agent. Fields: `id`, `title`, `flow`, `persona`,
`environment` (base_url, locale, viewport, auth, data_assumptions), `timebox_minutes`,
`out_of_scope`, `known_issues` (never re-reported, but noted if worse), `checks`
(`{id: CHK-*, desc, oracle}` — **every check must receive a verdict in the report**),
and `exploration_budget` (bounded free exploration + suggested edge probes).

## Report contract

`findings.json` per run (see `qa/schema/findings.schema.json`):

- `checks[]`: verdict `pass|fail|blocked|not-checked`; **evidence required for pass AND
  fail** (a pass without evidence is invalid); reason required for blocked/not-checked.
- `findings[]`: severity, confidence, category, repro steps, expected/actual, non-empty
  evidence.
- `not_tested[]` mandatory and non-empty; `coverage_summary` counts must add up.

Severity rubric: `blocker` (core flow impossible) / `major` (wrong behavior or data loss,
no workaround) / `minor` (degraded but usable) / `cosmetic` (polish) / `question` (**the
anti-noise bucket** — possibly intentional, needs human judgment).

Confidence: `high` = reproduced twice with evidence; `medium` = seen once with evidence;
`low` = suspected, not reproduced.

`report.md` is human-first: header + env block → verdict summary → checks matrix →
findings → **NOT tested** → known issues observed → limitations + next-charter
suggestions.

`scripts/qa/validate-report.ts` is the mechanical anti-false-confidence gate: every
charter check ID has exactly one verdict, evidence files exist on disk, findings are
complete, `not_tested` is non-empty, coverage arithmetic is correct.

## Safety rails

- `qa-dev.sh` and `mint-session.ts` refuse to run if `.env.qa` is missing, `QA_ENV=1` is
  not set, or the Supabase URL matches the one in `.env.local` (production).
- The skill never mutates GitHub/Slack/email. Findings land as local files; per-finding
  issue DRAFTS go to `qa/runs/<id>/proposed-issues/` and humans file the approved ones
  (`gh issue create --body-file …`). The committed `.claude/settings.json` denies
  `gh issue` mutations and GitHub-MCP issue tools repo-wide as a mechanical backstop.
- A check without observed evidence is `blocked` or `not-checked`, never `pass`.

## Validation of the pilot

1. Human performs `qa/SETUP.md` once (Supabase test project + seeds + `.env.qa`).
2. `pnpm qa:mint` URL logs a fresh browser in and lands authenticated on `/he` — the
   riskiest integration point (`token_hash` × `verifyOtp`; fallback: `type=email`).
3. `/qa-explore qa/charters/001-home-and-quiz.md` with the dev server down → the skill
   starts it, completes, produces a run dir with `report.md` + `findings.json` + ≥6
   screenshots; the validator passes; every check has a verdict; NOT-tested is
   non-empty.
4. **Negative test (anti-false-confidence proof)**: plant a deliberate bug (e.g. break a
   `messages/he.json` key or flip one seeded `correct_option` in the QA DB) → re-run →
   the agent must catch it with evidence, correct severity, and repro steps. Revert.
5. Guard tests: mint without `.env.qa` → refuses; `.env.qa` pointing at the prod URL →
   both `qa-dev.sh` and mint refuse.

## Future work (explicitly not in the pilot)

More charters (Arabic locale, flashcards, schedule, retry/review, dark mode,
zero-progress persona), video/trace capture, scheduled post-deploy smoke loop, CI
integration, cross-run findings dedupe/diff.
