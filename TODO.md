# TODO

## Security

- **Add rate limiting** — simplest approach is a Supabase Edge Function or a lightweight in-DB counter (e.g., one row per email per minute in a `rate_limits` table). Takes ~30–60 min. Worth doing before launch.

## Features

- **Push notifications** — `user_schedule` and `notify` flag are in the DB but no delivery mechanism exists yet
- **Retry mistakes** — a "practice mode" that re-queues only wrong questions as a mini-quiz (link from the review page)
- **More questions per topic** — `getQuestionsForTopic` is capped at 20; increase limit or paginate

## Gamification

- **Medal earn celebration** — the quiz API already returns `medals_earned` in its response but there's no UI reaction; show a toast or modal on the quiz page when a streak milestone is hit
- **Streak-to-next-medal nudge on home** — home page shows stats but gives no sense of progress toward the next medal; add a small "X days to your next medal" indicator so the streak system feels motivating

## Polish

- **Review page scope** — currently shows all-time mistakes; consider filtering to the most recent quiz session only
- **Explanation coverage** — many questions have `explanation_he = null`; populate or remove the field
- **Image fallback** — questions with missing images are silently filtered out; show a placeholder instead
