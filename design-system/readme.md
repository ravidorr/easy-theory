# ClearRoad · דרך ברורה — Design System

Design system for **ClearRoad** (Hebrew: **דרך ברורה**), a Hebrew-first (RTL) web app that helps a 16–17 year-old student pass the Israeli driving-theory exam without feeling overwhelmed. Source: internal PRD "QuietDrive v0.1" (3.7.2026), product renamed ClearRoad. Frontend target: vanilla JS/CSS/HTML; this system ships CSS tokens + React reference components for design work.

**Chosen direction:** "עדין ושובב" (soft & playful) — lilac pastels, Rubik, high gamification (streaks, stars, progress paths) with a calm, quiet surface. Approved by the owner from a 3-way exploration (option 1c).

## Product principles (from PRD)
1. שקט לפני הכל — clean, no visual noise
2. מנה אחת בכל פעם — one small topic at a time
3. קצב אישי — 30–60 min/day schedule
4. למידה פעילה — practice questions + flashcards, not passive reading
5. התקדמות נראית — every small step gets immediate positive reinforcement

## CONTENT FUNDAMENTALS
- **Language:** Hebrew only, full RTL. English never appears in UI copy (brand name "ClearRoad" may appear in the logotype).
- **Voice:** warm, encouraging, speaks directly to the learner in second person **feminine** (את): "ממשיכות", "יאללה, מתחילות!", "את באמצע". Short sentences. No jargon.
- **Tone of reinforcement:** celebratory but gentle. "כל הכבוד, שלב 3 הושלם!" — never pressuring ("נשארו רק X ימים" is forbidden framing).
- **Punctuation:** NO em-dashes (—) in copy. Use commas, periods, or restructure. Exclamation marks allowed sparingly for wins.
- **Emoji:** used very sparingly, at most one per screen, only for celebration moments. Prefer the icon set (Lucide) and the star/flame glyph components over emoji.
- **Numbers:** western digits. Times as "17:00". Durations as "20 דק׳".
- **Example copy:** "המשימה להיום: זכות קדימה, חלק 2" · "8 שאלות תרגול · ~20 דק׳" · "3 מתוך 8, את באמצע!"

## VISUAL FOUNDATIONS
- **Backgrounds:** flat solid `--bg` (#f8f6fb light / #1a1523 dark). No gradients, no textures, no imagery backgrounds. Quiet above all.
- **Cards:** white `--surface` on lilac-tinted `--bg`, 1px `--border`, radius `--radius-xl` (20px) for primary cards, `--radius-lg` (16px) nested, shadow `--shadow-card` (soft, purple-tinted). Screens/modals use `--radius-2xl`.
- **Color:** one primary (lilac purple, oklch hue 300), one reward accent (gold, hue 85), semantic green/red (hues 155/25) at matched chroma. Soft variants (`*-soft`) for chips/badges. Traffic-sign colors (`--sign-*`) are fixed and never themed.
- **Type:** Rubik only, 400–800. Display 32/800, H1 26/700, H2 20/600, body 16/400, small 13.5, caption 12/600. Line-height 1.25 headings, 1.55 body. Minimum UI text 12px.
- **Theming:** light default; dark via `[data-theme="dark"]` attribute. All components must work in both.
- **Buttons:** primary is the playful "pressable" pill/rounded button with hard bottom shadow `--shadow-press` (0 4px 0 primary-deep); on press it translates down 2px and shadow shrinks. Secondary is surface + border. Hover = darker fill (`--primary-hover`), never opacity.
- **Motion:** springy micro-interactions, `--ease-spring` for pop-ins (badges, stars), `--ease-out` for layout. Flashcard flip 420ms 3D rotateY. Durations 120/240ms. No parallax, no continuous ambient animation.
- **Gamification visuals (high, 8/10):** streak flame pill, star points pill (gold), step path (circles + connectors, current step enlarged with ring), medals. Progress everywhere, pressure nowhere.
- **Borders/dividers:** 1px `--border`; avoid heavy dividers, prefer spacing.
- **Corners:** generous everywhere. Pills (`--radius-pill`) for counters/CTAs, nothing sharper than 8px.
- **Transparency/blur:** none, except optional scrim behind modals (rgba(45,36,64,0.4)).
- **Hit targets:** minimum 44px (`--hit-min`).
- **Layout:** mobile-first single column (max ~440px content), desktop centers content with generous whitespace; responsive both ways.

## ICONOGRAPHY
- **Icon set:** [Lucide](https://lucide.dev) via CDN (`https://unpkg.com/lucide@latest`), rounded stroke style matching Rubik. Stroke width 2, size 18–24px, color `currentColor`. This is a substitution choice (no icon assets were provided); flag any replacement needs to the owner.
- **Traffic signs:** REAL official artwork extracted from the uploaded לוח התמרורים (Sept 2022, ק"ת 10328) PDF — see `assets/signs/`. 21 common signs as PNGs named `sign-<number>-<meaning>.png` (number omitted where mapping was not 100% certain). Never redraw signs by hand; extract more from `uploads/signs-chart.pdf` (94 pages) as needed.
- **Glyphs:** star (★) and flame are rendered by the `Star`/`Flame` glyph inside gamification components, gold/primary colored. No emoji in components.
- **Logo:** none provided. Render the wordmark in plain Rubik 800: "דרך ברורה" (or "ClearRoad"). Do not invent a logo mark.

## Index
- `styles.css` — global entry (imports all tokens)
- `tokens/` — colors (light+dark), typography, spacing/radius, effects
- `assets/signs/` — 21 official traffic-sign PNGs; `uploads/signs-chart.pdf` — full source chart
- `guidelines/` — foundation specimen cards (colors, type, spacing, radius, shadows, signs)
- `components/core/` — Button, IconButton, Chip, Card, Input, Switch
- `components/learning/` — QuizOption, Flashcard, ProgressBar, PathProgress, TopicCard
- `components/gamification/` — StreakPill, StarsPill, Medal
- `ui_kits/clearroad/` — app screens (home "המשימה להיום", quiz, flashcards, schedule)
- `SKILL.md` — agent skill entry point

## Intentional additions
Standard from-scratch component set (no source inventory existed). Learning + gamification families are derived directly from PRD P0 features.
