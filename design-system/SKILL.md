# SKILL: ClearRoad · דרך ברורה

How to build screens for ClearRoad, a Hebrew-first RTL driving-theory study app. Read `readme.md` first for principles, voice, and visual foundations. This file is the practical recipe.

## Setup (every page)

```html
<html lang="he" dir="rtl">
<link rel="stylesheet" href="styles.css">  <!-- imports all tokens; loads Rubik -->
```

- `dir="rtl"` is mandatory. All copy is Hebrew, second person **feminine**.
- Body: `background: var(--bg)`, mobile-first single column, max-width ~420–440px, padding 20px.
- Dark mode: set `data-theme="dark"` on `<html>`; use only tokens so it works automatically.

## Tokens (never hardcode)

- Colors: `--bg --surface --surface-2 --surface-3 --border --border-strong --text --text-muted --text-faint --primary --primary-hover --primary-deep --primary-soft --primary-soft-text --gold* --success* --danger*` (see `tokens/colors.css`). Traffic-sign colors `--sign-*` are fixed, never themed.
- Type: Rubik only. `--type-display/h1/h2/body/small/caption-*`. Minimum UI text 12px.
- Spacing/radius: `--space-1..12`, `--radius-sm/md/lg/xl/2xl/pill`, `--hit-min` (44px).
- Effects: `--shadow-card --shadow-pop --shadow-press --shadow-press-down --ease-spring --ease-out --dur-fast/med/flip`.

## Components (`components/`)

React reference implementations; each has a `.prompt.md` usage note and `.d.ts` props. For plain HTML, copy their inline styles (see `ui_kits/clearroad/` for copy-paste-ready markup).

- core: `Button` (primary = pressable, `--shadow-press`, translateY(2px) on press), `IconButton`, `Chip`, `Card`, `Input`, `Switch`, `TabBar` (bottom navigation)
- learning: `QuizOption` (idle/selected/correct/wrong + explanation), `Flashcard` (420ms rotateY flip), `ProgressBar`, `PathProgress` (step circles + connectors), `TopicCard`
- gamification: `StreakPill` (flame), `StarsPill` (gold, `delta` for "+40" rewards), `Medal`

## Screens (`ui_kits/clearroad/`)

Reference layouts: `home.html` (המשימה להיום + path + topics), `quiz.html` (progress bar + options + reward), `flashcards.html` (card + ידעתי/עוד לא), `schedule.html` (week strip + tasks + medals + calm exam card), `login.html` (magic-link email form + sent state), `schedule-setup.html` (day picker + time + duration chips + save), `resources.html` (external link cards, opens in new tab), `videos.html` (YouTube cards with real thumbnails, featured + row variants), `more.html` (עוד page: nav rows + dark mode + logout, tab bar reference markup).

## Navigation

Bottom **TabBar** with exactly 4 tabs: הבית (home) · נושאים (topics) · כרטיסיות (flashcards) · עוד (more). Schedule, videos, resources, dark-mode toggle, and logout live on the עוד page (`more.html`). Rules:

- TabBar appears on top-level screens only (home, topics, flashcards landing, more). Screens with it need ~88px bottom padding.
- Focused flows have NO tab bar: quiz session, flashcard session, login, schedule setup. Their only exit is the back (→) or close (✕) button in the top bar.
- Pages under עוד (schedule, videos, resources) open with a back button returning to עוד.
- Active tab: `--primary-soft-text`, weight 700. Inactive: `--text-faint`, weight 600.

## Assets

- Traffic signs: `assets/signs/sign-*.png` — official artwork, use as-is, **never redraw**. More can be extracted from `uploads/signs-chart.pdf`.
- Icons: Lucide CDN, stroke 2, 18–24px, `currentColor`. Star/flame come from the glyph SVGs inside the gamification components, not emoji.
- Logo: wordmark only, Rubik 800 "דרך ברורה". No logo mark.

## Hard rules

1. Quiet surfaces: flat `--bg`, no gradients, no textures, no ambient animation.
2. Voice: warm, feminine second person ("יאללה, מתחילות!"). NO em-dashes. No pressure framing (never countdowns like "נשארו רק X ימים").
3. Emoji: max one per screen, celebrations only.
4. Hit targets ≥ 44px; corners ≥ 8px; pills for counters/CTAs.
5. Progress everywhere, pressure nowhere: streak, stars, path, percent — always visible, always gentle.
6. Hover = darker fill, never opacity. Press = translateY(2px) + `--shadow-press-down`.
