---
id: "011-pwa-and-offline"
title: "PWA shell: manifest, service-worker caching, offline reload"
flow: "Load home → verify manifest + SW registration → browse pages to warm caches → go offline → reload visited pages from cache"
persona: >
  Hebrew-speaking learner who studies on the train with a flaky connection
  and has the app installed to their home screen. Expects pages they have
  already visited to open offline, and never to see stale answers where
  fresh data matters.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: true
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Dev server on 3100 serves /sw.js and the manifest; SW behavior in next dev may differ from production builds — note the mode in the report"
timebox_minutes: 25
out_of_scope:
  - "Push event handling and notificationclick (delivery is not browser-reachable in QA)"
  - "Install prompt / add-to-home-screen UX"
  - "Cache-version migration behavior across deploys"
  - "iOS/standalone-mode quirks"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-PWA-01
    desc: "Web app manifest is served and coherent"
    oracle: "The manifest linked from the page (manifest.webmanifest) returns 2xx JSON with dir=rtl, display=standalone, a start_url, and icons; theme color matches the app chrome"
  - id: CHK-PWA-02
    desc: "Service worker registers and takes control"
    oracle: "/sw.js returns 2xx; after loading /he and reloading once, navigator.serviceWorker.controller is non-null for the page"
  - id: CHK-PWA-03
    desc: "Caches are created with the expected shape"
    oracle: "CacheStorage contains `clearroad-*-v2` caches; after visiting home + one topic + flashcards, the pages cache holds visited navigations and the images cache holds fetched /signs/ images"
  - id: CHK-PWA-04
    desc: "Visited pages reload while offline"
    oracle: "With the browser offline, reloading /he (previously visited) renders the cached page instead of the browser's offline error; an unvisited page fails gracefully (report observed behavior)"
  - id: CHK-PWA-05
    desc: "API traffic is never cache-served"
    oracle: "No /api/ URL appears in any CacheStorage cache; while offline, an action that needs /api/ (e.g. confirming a quiz answer) surfaces the app's failure handling rather than fake success"
  - id: CHK-PWA-06
    desc: "Static assets use their cache strategies without staleness bugs"
    oracle: "Back online, sign images and /js/ assets load (from cache or network) with no mixed old/new breakage and no console cache errors"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across online phases; offline phases may log failed network fetches for uncached resources, but no unhandled exceptions from sw.js"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on the offline-rendered page"
    oracle: "The cache-served page keeps html lang/dir, headings, and accessible names identical to its online render"
  - id: CHK-COPY-RTL-01
    desc: "Offline/failure copy is localized"
    oracle: "Any app-rendered failure message shown while offline exists in he.json (no raw keys or hardcoded English)"
exploration_budget: "After all checks, up to 5 min within scope: offline navigation between two visited pages via the tab bar, rapid offline/online flapping during a page load, reload twice offline (cache stability)"
---

## Narrative

You are on the train. Open the app with a good connection, study briefly across a few
screens, then the tunnel hits — everything you already saw should still open; anything
that needs the server should fail honestly, in Hebrew, without lying about saved
progress.

This is the most tooling-sensitive charter, so run it last and be explicit about
harness limits: if the browser automation cannot toggle offline mode or inspect
CacheStorage, mark the affected checks `blocked` with what WAS observed — never
infer a pass. Also note that a dev-mode service worker can behave differently from
production; record which mode the run used.

Suggested sequence: load `/he`, reload once (SW takes control on second load), visit
one topic page and `/he/flashcards` to warm the page and image caches, verify cache
contents, THEN go offline and reload.

Route hints:

- Service worker `public/sw.js`, caches prefixed `clearroad-` (v1): navigations are
  network-first (pages cache), static assets cache-first, `/signs/`, `/questions/`
  and Next image routes cache-first (images cache), `/js/` and `/icons/`
  stale-while-revalidate. `/api/`, cross-origin, and RSC requests are deliberately
  never cached.
- Manifest from `src/app/manifest.ts` (name from the Metadata namespace, standalone,
  RTL). Registration happens in the locale layout.
- Useful probes: navigator.serviceWorker.controller, caches.keys(),
  caches.match(url) via the JS console.
- Meaningful-step screenshots: manifest response, SW controlling the page (devtools
  or probe output), cache key listing, offline reload success, offline failure of an
  API-dependent action, back-online recovery.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
