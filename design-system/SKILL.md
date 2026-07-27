# SKILL: Easy in theory · קל בתיאוריה

How to build screens for Easy in theory, a Hebrew-first RTL driving-theory study app. Read `readme.md` first for principles, voice, and visual foundations. This file is the practical recipe.

## Setup (every page)

```html
<html lang="he" dir="rtl">
<link rel="stylesheet" href="styles.css">  <!-- imports all tokens; loads Rubik -->
```

- `dir="rtl"` is mandatory. Copy is Hebrew-first with Arabic as a second locale; **gender-neutral** phrasing (see Hard rules).
- Body: `background: var(--bg)`, mobile-first single column, max-width ~420–440px, padding 20px.
- Dark mode: set `data-theme="dark"` on `<html>`; use only tokens so it works automatically.

## Tokens (never hardcode)

- Colors: `--bg --surface --surface-2 --surface-3 --border --border-strong --text --text-muted --text-faint --primary --primary-hover --primary-deep --primary-soft --primary-soft-text --accent* --brand-blue --gold* --success* --danger*` (see `tokens/colors.css`). Traffic-sign colors `--sign-*` are fixed, never themed.
- Type: Rubik only. `--type-display/h1/h2/body/small/caption-*`. Minimum UI text 12px.
- Spacing/radius: `--space-1..12`, `--radius-sm/md/lg/xl/2xl/pill`, `--hit-min` (44px).
- Effects: `--shadow-card --shadow-pop --shadow-press --shadow-press-down --ease-spring --ease-out --dur-fast/med/flip`.

## Components (`components/`)

React reference implementations; each has a `.prompt.md` usage note and `.d.ts` props. For plain HTML, copy their inline styles (see `ui_kits/easy-in-theory/` for copy-paste-ready markup).

- core: `Button` (primary = pressable, `--shadow-press`, translateY(2px) on press), `IconButton`, `Chip`, `Card`, `Input`, `Switch`, `TabBar` (bottom navigation)
- learning: `QuizOption` (idle/selected/correct/wrong + explanation), `Flashcard` (420ms rotateY flip), `ProgressBar`, `PathProgress` (step circles + connectors), `TopicCard`
- gamification: `StreakPill` (flame), `StarsPill` (gold, `delta` for "+40" rewards), `Medal`, `MedalCelebration` (one-time modal when the quiz API returns `medals_earned`; queue multiple, never auto-dismiss)

## Screens (`ui_kits/easy-in-theory/`)

Reference layouts: `landing.html` (public landing + login v2: hero h1 + phone screenshot slots, trust badge, login card, success card, outcome-first features, FAQ, emotional close — the app's front door and only SEO surface), `home.html` (המשימה להיום + path + topics), `quiz.html` (progress bar + options + reward), `flashcards.html` (card + ידעתי/עוד לא), `schedule.html` (week strip + tasks + medals + calm exam card), `login.html` (magic-link email form + sent state), `schedule-setup.html` (day picker + time + duration chips + save), `resources.html` (external link cards, opens in new tab), `videos.html` (YouTube cards with real thumbnails, featured + row variants), `more.html` (עוד page: nav rows + dark mode + logout, tab bar reference markup), `medal-earned.html` (celebration modal over quiz summary), `404.html` (branded not-found: clean no-entry sign, Hebrew strings + Arabic layout placeholder pending professional translation, light/dark, token notes), `email-magic-link.html` (branded sign-in email specimen), `email-magic-link-supabase.html` (Supabase-ready Magic Link / OTP template using `.RedirectTo` and `.TokenHash`), `exam.html` (simulation intro: rules card, start, attempts history with pass/fail chips), `exam-run.html` (active exam: timer + progress + count top bar, options with idle/selected only — no correct/wrong feedback during an exam — answered count, הקודמת/הבאה nav, result state), `review.html` (mistake review: scope toggle התרגול האחרון/כל הזמנים, ענית/נכון rows in danger/success, retry CTA, all-correct empty state), `credits.html` (קרדיטים: data sources + built-with link rows).

Home also carries: **readiness card** (מוכנות למבחן — big percent + level chip: high=success-soft, medium=gold-soft "בדרך הנכונה", low=danger-soft; caption cites how many simulations it's based on; empty state invites a first simulation), **exam CTA row** (timer icon tile + "30 שאלות · 40 דק׳"), and **כדאי לחזק weak-topics section** (accuracy % in danger text, gold fill — shown only when a topic dips below the threshold, max 2–3 rows, framing is an invitation, never a warning). More carries the **הישגים medals grid**: 4 streak milestones (3/7/14/30 — flame/star/diamond/trophy glyph SVGs), earned = gold ring, locked = surface-2 + text-faint.

## Navigation

Bottom **TabBar** with exactly 4 tabs: הבית (home) · נושאים (topics) · כרטיסיות (flashcards) · עוד (more). Schedule, videos, resources, dark-mode toggle, and logout live on the עוד page (`more.html`). Rules:

- TabBar appears on top-level screens only (home, topics, flashcards landing, more). Screens with it need ~88px bottom padding.
- Focused flows have NO tab bar: quiz session, flashcard session, login, schedule setup. Their only exit is the back (→) or close (✕) button in the top bar.
- Pages under עוד (schedule, videos, resources) open with a back button returning to עוד.
- Active tab: `--primary-soft-text`, weight 700. Inactive: `--text-faint`, weight 600.

## Public page & SEO

The landing/login page (`landing.html`) is the only page crawlers see — everything else is behind auth. Requirements:

- Server-render it (or static HTML); no client-only rendering for this page.
- `<title>` קל בתיאוריה · לומדים לתיאוריה בלי לחץ + `<meta name="description">` in Hebrew (see landing.html head).
- One `<h1>` with the value proposition; features as `<section>`/`<h3>` with real descriptive copy — never a bare form.
- Semantic elements (`header`/`section`/`footer`), `alt` text on sign images, `lang="he"` + `dir="rtl"` on `<html>`.
- Add Open Graph tags (`og:title`, `og:description`, `og:locale=he_IL`) and a canonical URL in the app.
- Voice rules apply to meta text too: warm, no pressure framing.

## Assets

- Traffic signs: `assets/signs/sign-*.png` — official artwork, use as-is, **never redraw**. More can be extracted from `uploads/signs-chart.pdf`.
- Icons: Lucide CDN, stroke 2, 18–24px, `currentColor`. Star/flame come from the glyph SVGs inside the gamification components, not emoji.
- Favicon: `assets/favicon/` — the “»” plate-blue mark (`favicon.svg` + PNG 16/32/180/512). Link tags:
  ```html
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/favicon-180.png">
  ```
  (use `favicon-512.png` for the web app manifest icon)
- Logo: pair Rubik 800 “קל בתיאוריה” with `assets/logomark.svg` on neutral surfaces or `assets/logomark-onblue.svg` on blue. In the app, use the tokenized inline mark so `--accent` and `--primary` adapt in dark mode.

## Implementation notes (aligned with the shipped app)

The production app (easy-theory) refactored the kit's inline styles into **CSS Modules per page + shared `btn-primary`/`btn-secondary`/`quiz-option` classes**, and consolidated all icons into **`icons.svg` — an SVG sprite** (`<use href="/icons.svg#icon-flame">`; symbols: flame, flame-gold, star, home, book, cards, more, timer, calendar, video, link, moon, heart, globe, chevron-left, external, play). Add new UI icons as sprite `<symbol>`s; the brand lockup is the intentional exception and uses its tokenized inline SVG. This kit's specimens stay inline-styled + inline-SVG for copy-paste readability; values must stay identical to the tokens.

Open ticket: home's "next medal" nudge renders medal emoji (🔥⭐💎🏆) — replace with the sprite glyphs (see the הישגים grid in `more.html`).

## Hard rules

1. Quiet surfaces: flat `--bg`, no gradients, no textures, no ambient animation.
2. Voice: warm, **gender-neutral Hebrew**. Prefer infinitives and first-person plural: "להתחיל עכשיו", "יש ללחוץ", "נמשיך", "יאללה, מתחילים!"; avoid gendered second-person forms (שלחי/שלח, בחרי/בחר). Older feminine strings still in the app need a copy pass. NO em-dashes. No pressure framing (never countdowns like "נשארו רק X ימים").
3. Emoji: max one per screen, celebrations only.
4. Hit targets ≥ 44px; corners ≥ 8px; pills for counters/CTAs.
5. Progress everywhere, pressure nowhere: streak, stars, path, percent — always visible, always gentle.
6. Hover = darker fill, never opacity. Press = translateY(2px) + `--shadow-press-down`.
