---
id: "010-static-pages-and-not-found"
title: "Videos, resources, credits + 404 handling for bad routes"
flow: "Videos → resources → credits (content + link hygiene) → bad topic slug → arbitrary bad path → localized 404 recovery"
persona: >
  Hebrew-speaking learner rounding out their study plan with the app's
  curated extras: video lessons and official links. Occasionally follows a
  stale bookmark or mistyped URL and expects the app to fail politely.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Static content pages are code-defined (no DB dependency); seeded topics are signs / traffic-laws / safety / vehicle, so any other slug is invalid"
timebox_minutes: 20
out_of_scope:
  - "Following external links off-origin beyond a status/href sanity probe (YouTube, gov.il content correctness)"
  - "The error boundary (error.tsx) — requires an induced server error"
  - "Arabic locale (007)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-STATIC-01
    desc: "Videos page renders its curated list"
    oracle: "/he/videos shows a non-empty list of lessons/marathons with titles from the Videos namespace; every link has a valid https href to the expected video domain and opens in a new tab"
  - id: CHK-STATIC-02
    desc: "Resources page renders its external links"
    oracle: "/he/resources shows a non-empty list with copy from the Resources namespace; every link has a valid https href and opens in a new tab"
  - id: CHK-STATIC-03
    desc: "Credits page renders attributions"
    oracle: "/he/credits shows data-source and technology attributions from the Credits namespace with valid https hrefs"
  - id: CHK-STATIC-04
    desc: "External links respond (sample probe)"
    oracle: "A sample of at least 3 external hrefs across the pages returns a non-error response to a direct status probe (2xx/3xx; flaky externals get question, not fail)"
  - id: CHK-404-01
    desc: "Unknown topic slug renders the localized 404"
    oracle: "/he/topics/not-a-real-slug shows the NotFound-namespace page (Hebrew, RTL) with a working back-home link — not a crash, blank page, or raw Next.js error"
  - id: CHK-404-02
    desc: "Arbitrary bad path renders the localized 404"
    oracle: "/he/no-such-page shows the same localized 404; the back-home link lands on /he"
  - id: CHK-404-03
    desc: "404 pages keep the app shell usable"
    oracle: "Tab bar (or equivalent navigation) is present and functional on the 404 page, so the user can recover without editing the URL"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps, including the 404 renders (warnings triaged case by case)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on static and 404 pages"
    oracle: "External links have accessible names indicating destination; new-tab behavior is discernible; a heading exists per page; html lang/dir correct"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (Videos/Resources/Credits/NotFound namespaces); no raw keys; external (Latin/URL) text embedded in RTL copy renders without breakage"
exploration_budget: "After all checks, up to 5 min within scope: unauthed visit to a bad path (should hit login first per proxy), a bad path with query params, /he/topics/<slug>/nonsense below a valid topic, root-level unknown locale prefix like /xx/foo"
---

## Narrative

You are padding out your study routine: skim the videos list for tonight's lesson,
check the official links, and see who is behind the app. Then play the clumsy user:
follow a dead bookmark and mistype a URL. The product promise here is modest but
real — content pages that are complete and trustworthy, and dead ends that keep you
inside the app.

Link hygiene beats link content: verify hrefs are well-formed, https, pointing at
plausible domains, and marked to open externally. Probe a small sample for liveness,
but treat a flaky external host as a `question` — the charter must not fail because
YouTube rate-limited a HEAD request.

Route hints:

- Pages `/he/videos`, `/he/resources`, `/he/credits` — static, code-defined lists
  with copy in the `Videos`, `Resources`, `Credits` namespaces.
- 404 machinery: unknown topic slugs call notFound() in the topic pages; any other
  unknown path hits the [...rest] catch-all; both render the localized
  `not-found.tsx` (NotFound namespace) inside the locale layout.
- Note for the report (not a check): GET `/api/topics/[slug]` exists in the codebase
  with no shipped caller — flag as a question for a human (legacy surface?).
- Meaningful-step screenshots: each static page, one external-link probe result, the
  404 for a bad topic slug, the 404 for a bad path, post-recovery home.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
