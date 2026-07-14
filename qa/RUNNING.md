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
4. **Report & publish** — stages `report.md` (human-first), `findings.json`
   (machine-readable), and evidence files in `qa/runs/<timestamp>_<charter-id>/`; the
   run must pass `pnpm qa:validate-report` (a check verdict without on-disk evidence is
   rejected). Then it publishes: pushes the run dir to the `qa-evidence` branch
   (`pnpm qa:publish-evidence`), files one GitHub issue per new finding — labeled with
   `qa`, a type label (`bug` / `enhancement` / `product-question`), and category labels
   (`a11y`, `copy`) where relevant, screenshots inline — comments "still reproduces"
   on matching open `qa` issues instead of filing duplicates, and files + closes a
   `qa-run` run-report issue as the archived record.
5. **Teardown** — closes the browser, stops the dev server if the run started it, and
   deletes the local run dir (the durable copy is GitHub). On a partial publish the
   dir is kept and the final message says exactly what was and wasn't published.

## Read the results

Everything lives on GitHub:

- **Findings** — open issues labeled `qa` (each: severity in the title, repro steps,
  expected/actual, confidence, environment, inline screenshots).
- **Run reports** — closed issues labeled `qa-run` (verdict summary → checks matrix →
  findings → the mandatory **NOT tested** list, plus `findings.json` in a collapsed
  block).
- **Raw evidence** — the `qa-evidence` branch, one `<run-id>/` directory per run.

Severity rubric: `blocker` / `major` / `minor` / `cosmetic` / `question` (possibly
intentional — needs a human decision). Confidence: `high` (reproduced twice) / `medium`
(seen once) / `low` (suspected).

## Triage issues (human)

The agent files the issues; your job is triage on GitHub: close findings that are
invalid or intentional (say why — the agent reads open `qa` issues to dedup future
runs), adjust severity, and pick up the real ones. The agent can create, comment on,
and close QA issues, but editing or deleting issues stays denied in
`.claude/settings.json`.

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
| `pnpm qa:publish-evidence <run-dir>` | Push a run dir to the `qa-evidence` branch |

## Design docs

[PLAN.md](PLAN.md) — the framework design, safety rails, and validation history.
`qa/runs/` is gitignored ephemeral staging; the durable copy is GitHub (issues +
the `qa-evidence` branch).
