---
name: qa-explore
description: Run an agentic exploratory QA session against the local QA environment from a test charter. Use when the user invokes /qa-explore with a charter path, or asks to "run QA", "exploratory QA", "smoke test the app", or "test a charter". Requires the one-time setup in qa/SETUP.md. Produces a structured findings report under qa/runs/.
---

# qa-explore — charter-driven exploratory QA

Run the charter given as the argument (e.g. `qa/charters/001-home-and-quiz.md`) against
the local QA environment, capture evidence, and produce a validated structured report.
You are a QA multiplier, not a rubber stamp: your job is to find what's wrong and to be
precise about what you did and did not verify.

## Hard rules (non-negotiable)

1. **Never mutate the outside world.** Do not create/comment/close GitHub issues or PRs,
   do not push, do not run mutating `gh` commands, do not send Slack/email. Findings are
   local files under `qa/runs/`; humans review them and file issues.
2. **Never run against production.** Abort unless preflight proves the QA Supabase
   project is in use (the guards in `qa:dev` / `qa:mint` enforce this — do not work
   around them).
3. **Never report "looks good".** Every charter check gets a verdict. A check you did
   not observe evidence for is `blocked` or `not-checked` — never `pass`. A `pass`
   without on-disk evidence is invalid and the validator will reject it.
4. Do not edit product code, seeds, or the charter during a run. If the charter is
   wrong, report that and stop.

Rule 1 is enforced mechanically for issues: the committed `.claude/settings.json`
denies `gh issue` mutations and the GitHub-MCP issue tools repo-wide. PR/push tooling
stays allowed for normal development — the skill rule (not a permission) covers those
during QA runs.

## Phase 1 — Preflight

1. Read the charter. Abort if it is missing, has no `- id: CHK-*` checks, or has no
   oracles.
2. Verify `.env.qa` exists and defines `QA_ENV=1` plus all variables listed in
   `.env.qa.example`. Abort otherwise, pointing at `qa/SETUP.md`.
3. Verify `NEXT_PUBLIC_SUPABASE_URL` in `.env.qa` differs from the one in `.env.local`.
4. Check the dev server: `curl -sf http://localhost:3100` — if down, start `pnpm qa:dev`
   in the background and poll until ready (up to ~60s). Remember whether you started it.
5. Seed sanity: `pnpm qa:mint --check`. Abort on failure ("DB not seeded — see
   qa/SETUP.md").
6. Create the run dir: `qa/runs/<YYYY-MM-DDTHH-mm>_<charter-id>/` with a `screenshots/`
   subdirectory.
7. Record the environment block: `git rev-parse HEAD`, `package.json` version, base_url,
   viewport, locale, and the Supabase host (host only — never keys).

## Phase 2 — Session mint

1. Run the unauthed check FIRST (mint tokens are one-time-use): navigate a fresh
   Playwright browser to the base URL and record the login redirect.
2. `pnpm --silent qa:mint` → a single-line URL. Navigate the browser to it.
3. Verify you land authenticated (per the charter's auth oracle). If you land on
   `auth/login?error=1`, re-mint once; if it fails again, mark all auth-dependent checks
   `blocked` (reason: auth mint failed) and still produce the full report.

## Phase 3 — Charter execution

Work through the checks in order, in persona, using the Playwright MCP tools
(`browser_navigate`, `browser_click`, `browser_snapshot`, `browser_take_screenshot`,
`browser_console_messages`, `browser_network_requests`). Set the viewport from the
charter (`browser_resize`).

Conventions:

- Prefer `browser_snapshot` for reading state — it exposes roles and accessible names,
  which also feeds the a11y checks. Screenshot at every meaningful step:
  `screenshots/step-NN-<slug>.png`, and reference every screenshot from the report.
- After each page load or major interaction, append new console errors to `console.log`
  and non-2xx/3xx requests to `network.log`, each annotated with the step name.
- On a suspected finding: capture screenshot + the relevant DOM snapshot excerpt +
  console/network state at that moment, then **attempt one reproduction** before writing
  it up. Confidence: `high` = reproduced twice with evidence, `medium` = seen once with
  evidence, `low` = suspected, not reproduced.
- Copy checks: read the `messages/he.json` namespaces the charter names and compare
  against visible text. Flag raw keys, English leakage, and RTL/direction breakage.
- Before writing any finding, check the charter's `known_issues` — matches go into
  `known_issues_observed` (noting if worse), not into findings.
- Respect `timebox_minutes`. On overflow, mark remaining checks `not-checked` with
  reason "timebox". Then, if time allows, do the bounded free exploration in
  `exploration_budget` — findings from exploration are regular findings.

## Phase 4 — Report

1. Write `findings.json` in the run dir per `qa/schema/findings.schema.json`.
2. Write `report.md`: header + environment block → verdict summary (one line, e.g.
   "9/12 pass, 1 fail (major), 1 blocked, 1 not-checked") → checks matrix table
   (Check | Verdict | Observed | Evidence) → one section per finding (severity,
   confidence, repro steps, expected/actual, evidence links) → **NOT tested**
   (mandatory, at minimum echoing the charter's out_of_scope) → known issues observed →
   limitations and next-charter suggestions.
3. For every finding, write a ready-to-file issue draft at
   `proposed-issues/<finding-id>-<slug>.md` in the run dir:
   - First line: `# <issue title>` (imperative, prefixed with the severity in brackets,
     e.g. `# [major] Progress not saved when …`)
   - Then a `Suggested labels:` line (`bug` / `a11y` / `copy` / `product-question` per
     the finding category; `question`-severity findings get `product-question`, not `bug`)
   - Then the body: repro steps, expected/actual, severity + confidence, environment
     block, and evidence paths (note they live locally in the run dir — attach manually)
   - These are DRAFTS. Never file them yourself. The human files approved ones with:
     `gh issue create --title "…" --body-file qa/runs/<run>/proposed-issues/<file>.md`
4. Run `pnpm qa:validate-report <run-dir> <charter-path>`. Fix the report until it
   passes — this gate is not optional.
5. Final message to the user: one-paragraph outcome, the run-dir path, the checks
   matrix, the explicit NOT-tested list, and the list of proposed-issue drafts awaiting
   human review. Never a bare "all good".

## Phase 5 — Teardown

- Close the browser (`browser_close`).
- Kill the dev server only if this run started it.
- Note in the report that the test user's data was mutated by the run (expected;
  `qa/SETUP.md` has a reset snippet).
