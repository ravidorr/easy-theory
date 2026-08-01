# Contributing to Easy in theory

Thanks for your interest in contributing. Easy in theory is a Hebrew-first RTL driving theory study app built with Next.js 15.

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

## Git hooks

Linters run on every commit (pre-commit). The release rule is per PR, checked on push (pre-push): every pushed branch must add exactly one top-level `CHANGELOG.md` release entry and make exactly one stable SemVer increment from `origin/main`. The entry version and `package.json` version must match. Individual commits within a PR do not need their own bump or entry. Hooks are installed automatically via `pnpm install` (husky `prepare` script).

- Add one `## [x.y.z]` section as the first released section in `CHANGELOG.md`, describing the whole PR
- Bump `package.json` once per PR: patch for a backward-compatible fix, minor for a backward-compatible feature, or major for a breaking change
- Preserve every existing release heading; insert the new heading instead of renaming one

If `main` releases a version while your PR is open, renumber your entry and bump when you rebase.

The historical changelog was normalized once from `0.3.252` to `0.56.3`; subsequent releases use the normal direct-increment rule.

## Code conventions

- **No `'use client'`** — all components are React Server Components. Client interactivity lives in `public/js/` as vanilla JS loaded via `<Script strategy="afterInteractive">`.
- **Design tokens only** — never hardcode colors, radii, or font sizes. Use CSS variables from the design system (`--bg`, `--primary`, `--radius-lg`, etc.).
- **Hebrew copy** — all user-facing text is Hebrew, second person feminine voice. No em-dashes. No pressure framing.
- **RTL** — the app is `dir="rtl"`. Use CSS logical properties (`padding-inline-start` not `padding-left`). For fixed/absolute centering use `left: 50%; transform: translateX(-50%)`.
- **No comments** unless the *why* is non-obvious.

## Questions

Open an issue — happy to help.
