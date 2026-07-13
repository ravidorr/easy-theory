# Running the Agentic QA

One-time environment setup lives in [SETUP.md](SETUP.md) (QA Supabase project, seeds,
`.env.qa`). Once that's done, every run is a single command.

## Run a charter

In a Claude Code session inside this repo:

```text
/qa-explore qa/charters/001-home-and-quiz.md
```

The skill does everything itself:

1. **Preflight** — validates the charter, checks `.env.qa` (and refuses to run if it
   points at the production Supabase project), starts the QA dev server on port 3100 if
   it's down, and verifies the seeded data (`pnpm qa:mint --check`).
2. **Auth** — verifies the unauthed login redirect, then mints a one-time login link for
   `qa-user@clearroad.test` via the Supabase admin API (no email involved) and logs the
   browser in.
3. **Execution** — works through every charter check in persona, capturing screenshots,
   console errors, and failed network requests as evidence, then spends the charter's
   bounded exploration budget on edge probes.
4. **Report** — writes `qa/runs/<timestamp>_<charter-id>/` containing `report.md`
   (human-first), `findings.json` (machine-readable), evidence files, and a ready-to-file
   GitHub issue draft per finding under `proposed-issues/`. The run must pass
   `pnpm qa:validate-report` — a check verdict without on-disk evidence is rejected.
5. **Teardown** — closes the browser, stops the dev server if the run started it, and
   backs up the run dir to `~/qa-runs-backup/`.

## Read the results

Start with `qa/runs/<run>/report.md`: verdict summary → checks matrix → findings (each
with severity, confidence, repro steps, evidence) → the mandatory **NOT tested** list.

Severity rubric: `blocker` / `major` / `minor` / `cosmetic` / `question` (possibly
intentional — needs a human decision). Confidence: `high` (reproduced twice) / `medium`
(seen once) / `low` (suspected).

## File issues (human-only)

The agent never touches GitHub — that's a hard rule, mechanically enforced by the deny
rules in `.claude/settings.json`. Review the drafts and file the ones you approve:

```bash
gh issue create --title "<title from the draft>" \
  --body-file "qa/runs/<run>/proposed-issues/<finding>.md"
```

## Write a new charter

```bash
cp qa/charters/TEMPLATE.md qa/charters/002-my-flow.md
```

Fill in the flow, persona, environment, and above all the `checks` — each needs a
concrete, observable oracle (something decidable from the page, console, or network).
Declare `out_of_scope` honestly (it feeds the NOT-tested section) and list
`known_issues` you don't want re-reported. Then run `/qa-explore` with the new path.

## Handy commands

| Command | What it does |
| --- | --- |
| `pnpm qa:dev` | Start the QA dev server manually (port 3100) |
| `pnpm qa:mint --check` | Verify DB connectivity + seed counts |
| `pnpm qa:mint` | Print a one-time login URL for manual poking |
| `pnpm qa:validate-report <run-dir> <charter>` | Re-run the report completeness gate |

## Design docs

[PLAN.md](PLAN.md) — the framework design, safety rails, and validation history.
Run artifacts under `qa/runs/` are gitignored; the durable copy is `~/qa-runs-backup/`.
