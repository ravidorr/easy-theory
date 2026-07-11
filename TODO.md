# TODO

## Features

- **Push notifications** — `user_schedule` and `notify` flag are in the DB but no delivery mechanism exists yet
- **Retry mistakes** — a "practice mode" that re-queues only wrong questions as a mini-quiz (link from the review page)

## Design System

- **SVG sprite** — inline SVGs are scattered across all UI kit HTML mockups; consolidate into a single `design-system/icons.svg` sprite (`<symbol id="icon-home">` etc.) and reference with `<svg><use href="icons.svg#icon-home"/></svg>` to keep HTML clean while preserving `currentColor` theming

## Polish

- **Review page scope** — currently shows all-time mistakes; consider filtering to the most recent quiz session only
- **Explanation coverage** — many questions have `explanation_he = null`; populate or remove the field
- **Image fallback** — questions with missing images are silently filtered out; show a placeholder instead
