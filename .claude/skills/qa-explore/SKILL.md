---
name: qa-explore
description: Run an agentic exploratory QA session against the local QA environment from a test charter. Use when the user invokes /qa-explore with a charter path, or asks to "run QA", "exploratory QA", "smoke test the app", or "test a charter". Requires the one-time setup in qa/SETUP.md. Publishes findings as GitHub issues, with evidence on the qa-evidence branch.
---

# qa-explore — charter-driven exploratory QA

Run the charter given as the argument (e.g. `qa/charters/001-home-and-quiz.md`) against
the local QA environment, capture evidence, validate the structured report, and publish
the results to GitHub (issues + evidence branch). You are a QA multiplier, not a rubber
stamp: your job is to find what's wrong and to be precise about what you did and did
not verify.

## Hard rules (non-negotiable)

1. **Only the scoped QA mutations of the outside world.** The ONLY external mutations
   allowed during a run are: (a) `pnpm qa:publish-evidence <run-dir>` (pushes to the
   `qa-evidence` branch only), (b) `gh issue create` / `gh issue comment` /
   `gh issue close` for this run's findings and run report, and (c) idempotent
   `gh label create --force` for the QA labels. Nothing else: no pushing code branches,
   no PRs, no editing or deleting existing issues, no Slack/email.
2. **Never run against production.** Abort unless preflight proves the QA Supabase
   project is in use (the guards in `qa:dev` / `qa:mint` enforce this — do not work
   around them).
3. **Never report "looks good".** Every charter check gets a verdict. A check you did
   not observe evidence for is `blocked` or `not-checked` — never `pass`. A `pass`
   without on-disk evidence is invalid and the validator will reject it.
4. Do not edit product code, seeds, or the charter during a run. If the charter is
   wrong, report that and stop.

Rule 1 is backed mechanically where possible: the committed `.claude/settings.json`
allows `gh issue create/comment/close`, `gh label create`, and the publish script, and
still denies `gh issue edit/delete` and the GitHub-MCP issue-update tool. PR/push
tooling stays allowed for normal development — the skill rule (not a permission)
covers those during QA runs.

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
   subdirectory. This is ephemeral staging — it is published to GitHub in Phase 4 and
   deleted in teardown.
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

## Phase 4 — Report & publish

1. Write `findings.json` in the run dir per `qa/schema/findings.schema.json`.
2. Write `report.md`: header + environment block → verdict summary (one line, e.g.
   "9/12 pass, 1 fail (major), 1 blocked, 1 not-checked") → checks matrix table
   (Check | Verdict | Observed | Evidence) → one section per finding (severity,
   confidence, repro steps, expected/actual, evidence links) → **NOT tested**
   (mandatory, at minimum echoing the charter's out_of_scope) → known issues observed →
   limitations and next-charter suggestions.
3. Run `pnpm qa:validate-report <run-dir> <charter-path>`. Fix the report until it
   passes — this gate is not optional, and nothing gets published before it passes.
4. Publish the evidence: `pnpm qa:publish-evidence <run-dir>`. It pushes the run dir to
   the `qa-evidence` branch and prints the raw base URL
   (`https://raw.githubusercontent.com/<slug>/qa-evidence/<run-id>/`). Use that URL for
   every evidence reference in issue bodies — screenshots embed inline with
   `![…](<base-url>screenshots/step-NN-<slug>.png)`.
5. Ensure the QA labels exist (idempotent — `--force` updates in place):
   `gh label create qa --color 5319e7 --description "Filed by the QA agent" --force`,
   and likewise `qa-run` (archived run reports), `a11y`, `copy`, `product-question`.
   The type labels `bug` and `enhancement` are GitHub defaults — assume they exist.
6. Dedup before filing: fetch open QA issues once —
   `gh issue list --state open --label qa --limit 200 --json number,title,body`
   (the default limit is 30 and truncates silently). A finding matches
   an existing issue when it describes the same symptom in the same flow (judge by
   title + repro, not exact wording). For each match, do NOT file a new issue; instead
   `gh issue comment <number>` with "Still reproduces in run `<run-id>`", the severity +
   confidence observed this run, and evidence links.
7. File one issue per remaining (new) finding:
   - Title: imperative, prefixed with the severity in brackets, e.g.
     `[major] Progress not saved when …`
   - Labels: `qa` + exactly one TYPE label + category labels where they apply:
     - Type: `bug` for defects (something behaves wrongly — the usual case),
       `enhancement` for findings that are really a feature/improvement request,
       `product-question` for `question`-severity findings (possibly intentional —
       needs a product decision, not `bug`)
     - Category (additive, when relevant): `a11y` for accessibility findings, `copy`
       for copy/translation findings (e.g. an a11y defect gets `qa` + `bug` + `a11y`)
   - Body: repro steps, expected/actual, severity + confidence, environment block,
     inline screenshots + evidence links into `qa-evidence`, and a "Found in run
     `<run-id>`" line (link the run-report issue after step 8 is done, or reference
     the `qa-evidence` run URL).
8. File the run-report issue (every run, even with zero findings): title
   `QA run <run-id>: <verdict summary>`, labels `qa` + `qa-run`. Body: the full
   `report.md` content with evidence paths rewritten to `qa-evidence` raw URLs, links
   to every finding issue and dedup comment posted in steps 6–7, and `findings.json`
   inside a collapsed `<details>` block. Then close it immediately
   (`gh issue close <number> --reason completed`) — it is an archived record, not a
   task; open `qa`-labeled issues must stay = actionable findings only.
9. If any publish step (4–8) fails: stop publishing, keep the local run dir, and tell
   the user exactly what was and was not published. Never delete an unpublished run.
10. Final message to the user: one-paragraph outcome, the checks matrix, the explicit
    NOT-tested list, the created issue URLs (findings + run report), any dedup
    comments posted, and the `qa-evidence` run URL. Never a bare "all good".

## Phase 5 — Teardown

- Close the browser (`browser_close`).
- Kill the dev server only if this run started it.
- **Delete the run dir** (`rm -rf qa/runs/<run-id>`) — but only if Phase 4 published
  everything successfully. The durable copy is GitHub: the issues and the `qa-evidence`
  branch. On a partial publish, keep the dir and say so in the final message.
- Note in the report that the test user's data was mutated by the run (expected;
  `qa/SETUP.md` has a reset snippet).
