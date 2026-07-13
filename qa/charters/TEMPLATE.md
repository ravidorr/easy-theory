---
# Unique charter id — also used in run-dir names: qa/runs/<timestamp>_<id>/
id: "NNN-short-slug"
title: "One-line human title"
# One-line route through the app.
flow: "Entry point → key interactions → expected end state"
# Who the agent is pretending to be, and their mindset/expectations.
persona: >
  Describe the user: language, device habits, prior state (new vs. returning),
  what they expect from the product.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  # Mobile-first app — default to a phone viewport unless the charter is about desktop.
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  # What the seeded QA DB is assumed to contain — the agent verifies this in preflight.
  data_assumptions: "Seeded test DB: 1273 questions, 277 signs, seeded topics"
# Hard cap. When exceeded, remaining checks are reported as not-checked (reason: timebox).
timebox_minutes: 25
# Echoed into the report's NOT-tested section. Be explicit — this is the
# anti-false-confidence contract: what this run does NOT vouch for.
out_of_scope:
  - "Example: push notifications / service worker"
# Never re-reported as findings; still noted if the behavior got WORSE.
known_issues:
  - id: "KI-001"
    summary: "Example: explanation row hidden when explanation_he is null — by design"
# The contract: EVERY check below must receive a verdict (pass/fail/blocked/not-checked)
# in the report, and pass/fail require on-disk evidence. Keep oracles concrete and
# observable — a check the agent can't decide from the page/console/network is a bad check.
checks:
  - id: CHK-EXAMPLE-01
    desc: "What is being verified"
    oracle: "The concrete, observable condition that decides pass/fail"
# Bounded free exploration AFTER the checks, within scope. Suggest edge probes.
exploration_budget: "Up to 5 min: e.g. rapid double-clicks, browser back mid-flow, reload mid-flow"
---

## Narrative

Free-form guidance for the agent: the suggested route through the app, what the persona
would notice, what counts as a "meaningful step" for screenshots, seeded-data quirks,
and hints about where the implementation hooks live (element ids, API endpoints,
`messages/he.json` namespaces in play).

Severity rubric for findings (keep consistent across charters):

- **blocker** — core flow impossible (can't log in, quiz won't load, data loss)
- **major** — wrong behavior/data with user impact, no reasonable workaround
- **minor** — degraded but usable (layout break, non-blocking console error)
- **cosmetic** — visual/copy polish
- **question** — possibly intentional; needs a human decision (the anti-noise bucket)
