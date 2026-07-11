# TODO

## Features

- **Push notifications** — `user_schedule` and `notify` flag are in the DB but no delivery mechanism exists yet
- **Retry mistakes** — a "practice mode" that re-queues only wrong questions as a mini-quiz (link from the review page)
- **More questions per topic** — `getQuestionsForTopic` is capped at 20; increase limit or paginate

## Gamification

- **Streak-to-next-medal nudge on home** — home page shows stats but gives no sense of progress toward the next medal; add a small "X days to your next medal" indicator so the streak system feels motivating

## Design System

- **SVG sprite** — inline SVGs are scattered across all UI kit HTML mockups; consolidate into a single `design-system/icons.svg` sprite (`<symbol id="icon-home">` etc.) and reference with `<svg><use href="icons.svg#icon-home"/></svg>` to keep HTML clean while preserving `currentColor` theming

## Polish

- **Review page scope** — currently shows all-time mistakes; consider filtering to the most recent quiz session only
- **Explanation coverage** — many questions have `explanation_he = null`; populate or remove the field
- **Image fallback** — questions with missing images are silently filtered out; show a placeholder instead
