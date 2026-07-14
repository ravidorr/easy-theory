---
id: "008-auth-and-login-edges"
title: "Login page UX, OTP send, resend throttle, expired-link and callback edges"
flow: "Unauthed deep link → login redirect with return path → email validation → send OTP → sent banner + resend throttle → expired/garbage link error path"
persona: >
  Hebrew-speaking learner on their phone who is logged out (new device or
  after logout). Slightly impatient: types their email wrong once, wonders
  if the mail arrived, taps resend, and sometimes opens the magic link too
  late. Expects clear guidance at every misstep.
environment:
  base_url: "http://localhost:3100"
  locale: "he"
  viewport: { width: 390, height: 844 }
  auth:
    required: false
    user: "qa-user@clearroad.test"
    mint: "pnpm qa:mint"
  data_assumptions: "Seeded test DB; send-otp is rate-limited 3 per 15 min per email — use unique plus-tag emails (qa-user+<run-ts>@clearroad.test) so re-runs never inherit an exhausted limit"
timebox_minutes: 25
out_of_scope:
  - "Receiving real email / completing the magic link (authed flows use pnpm qa:mint instead)"
  - "Supabase-side link expiry timing (only the ?error=1 rendering is checked)"
  - "Authed flows after login (001-007)"
  - "Desktop viewport"
known_issues: []
checks:
  - id: CHK-LOGIN-01
    desc: "Unauthed deep link redirects to login and preserves the return path"
    oracle: "Fresh (cookie-less) visit to /he/exam lands on /he/auth/login; the hidden #next-path input carries /exam (or equivalent next param) for post-login redirect"
  - id: CHK-LOGIN-02
    desc: "Login page renders its full pitch"
    oracle: "#login-form with #email-input and #send-btn visible; hero/features/reassurance copy from the Login namespace renders; page is RTL Hebrew"
  - id: CHK-LOGIN-03
    desc: "Invalid email is rejected client-side"
    oracle: "Submitting an invalid email (e.g. 'not-an-email') does not POST /api/auth/send-otp; a localized validation message appears; the form stays usable"
  - id: CHK-LOGIN-04
    desc: "Valid email sends the OTP and shows the sent banner"
    oracle: "Submitting qa-user+<run-ts>@clearroad.test POSTs /api/auth/send-otp with 2xx; #sent-banner becomes visible with the localized sent copy; #login-error stays hidden"
  - id: CHK-LOGIN-05
    desc: "Resend is throttled client-side"
    oracle: "After sending, #resend-btn is disabled or refuses action for ~60s with feedback in #resend-msg; after the window it allows one resend which POSTs send-otp again"
  - id: CHK-LOGIN-06
    desc: "Expired-link error state renders"
    oracle: "/he/auth/login?error=1 shows the localized linkExpired message alongside a usable login form"
  - id: CHK-LOGIN-07
    desc: "Garbage callback tokens fail closed"
    oracle: "GET /auth/callback?token_hash=garbage&type=email redirects to the login page with error=1 and no session is created (subsequent /he still redirects to login)"
  - id: CHK-LOGIN-08
    desc: "Server rate limit produces a graceful error"
    oracle: "The 4th send within 15 min for the SAME plus-tag email returns 429 and the page shows a localized error in #login-error (no crash, no silent success). Run this LAST with a dedicated plus-tag email"
  - id: CHK-CONSOLE-01
    desc: "No console errors anywhere in the flow"
    oracle: "Browser console contains zero error-level entries across all steps (warnings triaged case by case; expected 4xx responses must be handled, not thrown)"
  - id: CHK-A11Y-01
    desc: "Accessibility basics on the login page"
    oracle: "#email-input is labeled; error and sent messages are announced (live region or focus move) and not color-only; #send-btn has an accessible name; a heading exists; html lang/dir correct"
  - id: CHK-COPY-RTL-01
    desc: "No hardcoded or direction-broken strings in the flow"
    oracle: "Visible strings exist in he.json (Login/JS.Auth namespaces); no raw keys; email addresses (LTR content) render inside RTL copy without breakage"
exploration_budget: "After all checks, up to 5 min within scope: double-click send, submit an empty form, an absurdly long email, /auth/callback with no params at all, ?next= pointing at an external URL (must not open-redirect)"
---

## Narrative

You are locked out and trying to get in. Follow the unhappy paths deliberately: typo
your email first, then send properly, get impatient and hammer resend, and simulate
opening a stale link. The one thing this charter cannot do is read the mailbox — the
magic-link completion is proven separately by the mint script, so focus on everything
around it.

Sequencing matters for rate limits: send-otp allows 3 sends per 15 minutes per email.
Use a fresh `qa-user+<run-ts>@clearroad.test` address for the happy-path checks, and a
second dedicated plus-tag address for CHK-LOGIN-08 (which intentionally exhausts the
limit). Never burn the limit on the plain qa-user address other runs depend on.

Route hints:

- Login page `/he/auth/login` (the only public page), driven by `public/js/auth.js`.
  Hooks: `#login-form`, `#email-input`, `#next-path`, `#send-btn`, `#sent-banner`,
  `#login-error`, `#resend-btn`, `#resend-msg`.
- API: POST `/api/auth/send-otp` (Supabase magic link; sets a 10-min auth_redirect
  cookie). Callback: GET `/auth/callback?token_hash=&type=` — failure redirects to
  `/auth/login?error=1`.
- Use a fresh browser context (no cookies) so the unauthed redirect in CHK-LOGIN-01
  is genuine.
- Copy sources: `messages/he.json`, namespaces `Login`, `JS.Auth`, plus `Api` for
  server error messages.
- Meaningful-step screenshots: login redirect from deep link, validation error, sent
  banner, resend throttle state, error=1 banner, rate-limit error.

Severity rubric: blocker / major / minor / cosmetic / question — see
`qa/charters/TEMPLATE.md`. When unsure whether something is a bug or a product decision,
file it as `question`, not `minor`.
