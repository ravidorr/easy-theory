# Changelog

All notable changes to ClearRoad (דרך ברורה) are documented here.

## [Unreleased]

## [0.1.0] — 2026-07-04

### Added
- **Auth** — magic-link email login (no password), session middleware, logout
- **Home** — streak pill, stars pill, today's task card with PathProgress, topic list with progress bars, TabBar
- **Topics** — topic list page; quiz session per topic with sign images in questions and answer options
- **Flashcards** — 277 sign cards with 420ms flip animation; back face shows clean sign name and ghost image
- **Schedule** — weekly day picker, time and duration inputs
- **More** — navigation hub to Schedule / Videos / Resources; dark mode toggle (cookie-persisted, no FOUC); logout
- **Videos** — featured video + topic-grouped rows with YouTube thumbnails
- **Resources** — external links: gov sign chart, official question bank, noeg.co.il, Wikipedia
- **Design system** — full token set (colors, type, spacing, radius, effects), component library, screen references
- **Assets** — 277 official sign PNGs (לות״ם September 2022)
- **Seeds** — schema SQL, 4 topics, 1,802 questions, 277 signs with names patch for 9 OCR-failed entries
- **Deployment** — Vercel (production: easy-theory-omega.vercel.app), Supabase for DB + auth, Resend for email delivery

### Fixed
- TabBar centering in RTL: replaced `insetInlineStart: 0` with `left: 50% / translateX(-50%)`
- Flashcard back face: OCR-extracted sign numbers replaced with real Hebrew names via `cleanName()`
- Dark mode: theme cookie read server-side in layout so correct theme renders with zero flash

### Changed
- `middleware.ts` renamed to `proxy.ts` per Next.js 16 convention
