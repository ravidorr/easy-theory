# דרך ברורה · ClearRoad

A Hebrew-first RTL driving theory study app for the Israeli car-B license exam. Built for a 16-year-old — warm, encouraging, no pressure.

[![Vercel](https://therealsujitk-vercel-badge.vercel.app/?app=easy-theory-omega)](https://easy-theory-omega.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/ravidorr/easy-theory)](https://github.com/ravidorr/easy-theory/commits/main)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)

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
