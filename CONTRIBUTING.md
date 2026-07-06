# Contributing to ClearRoad

Thanks for your interest in contributing. ClearRoad is a Hebrew-first RTL driving theory study app built with Next.js 15.

## Getting started

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A free [Supabase](https://supabase.com) project

### Local setup

```bash
git clone https://github.com/ravidorr/easy-theory.git
cd easy-theory
pnpm install
```

Create `.env.local`:

```sh
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the schema and seed SQL files from `seeds/` in your Supabase SQL editor in order:

1. `schema.sql`
2. `topics.sql`
3. `questions.sql`
4. `signs.sql`
5. `signs_names_patch.sql`

Then start the dev server:

```bash
pnpm dev
```

## Making changes

- Branch off `main`: `git checkout -b your-feature-branch`
- Open a pull request against `main` — no direct pushes to `main`
- Keep PRs focused; one thing per PR

## Pre-commit hook

Every commit must include both a `CHANGELOG.md` update and a `package.json` version bump, or the commit will be rejected. The hook is installed automatically via `pnpm install` (husky `prepare` script).

- Add a bullet under the appropriate `## [x.y.z]` section in `CHANGELOG.md`
- Bump the patch version in `package.json` (e.g. `0.1.4` → `0.1.5`)

Stage both files along with your other changes before committing.

## Code conventions

- **No `'use client'`** — all components are React Server Components. Client interactivity lives in `public/js/` as vanilla JS loaded via `<Script strategy="afterInteractive">`.
- **Design tokens only** — never hardcode colors, radii, or font sizes. Use CSS variables from the design system (`--bg`, `--primary`, `--radius-lg`, etc.).
- **Hebrew copy** — all user-facing text is Hebrew, second person feminine voice. No em-dashes. No pressure framing.
- **RTL** — the app is `dir="rtl"`. Use CSS logical properties (`padding-inline-start` not `padding-left`). For fixed/absolute centering use `left: 50%; transform: translateX(-50%)`.
- **No comments** unless the *why* is non-obvious.

## Questions

Open an issue — happy to help.
