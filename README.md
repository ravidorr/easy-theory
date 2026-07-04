# דרך ברורה · ClearRoad

A Hebrew-first RTL driving theory study app for the Israeli car-B license exam. Built for a 16-year-old — warm, encouraging, no pressure.

**Live:** [easy-theory-omega.vercel.app](https://easy-theory-omega.vercel.app)

## Features

- **Magic-link auth** — no passwords, email only
- **Quiz practice** — 1,802 official theory questions, organized by topic, with sign images inline
- **Sign flashcards** — all 277 official Israeli traffic signs with flip animation
- **Progress tracking** — streak, star points, per-topic progress
- **Weekly schedule** — pick study days and times
- **Dark mode** — cookie-persisted, zero flash on load
- **Hebrew RTL** — Rubik font, feminine voice throughout

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Components only — no `'use client'`)
- [Supabase](https://supabase.com) — Postgres + magic-link auth
- Vanilla JS in `public/js/` for all client interactivity
- Design system in `design-system/` — CSS tokens + component library

## Data sources

- **Questions** — 1,802 official theory exam questions from [data.gov.il](https://data.gov.il)
- **Signs** — 277 official traffic sign PNGs from the Israeli Ministry of Transport (לות״ם, September 2022)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) — traffic sign images are official government artwork and carry their own terms.
