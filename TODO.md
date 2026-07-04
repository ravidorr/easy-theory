# TODO

## Features

- **Push notifications** — `user_schedule` and `notify` flag are in the DB but no delivery mechanism exists yet
- **Retry mistakes** — a "practice mode" that re-queues only wrong questions as a mini-quiz (link from the review page)
- **More questions per topic** — `getQuestionsForTopic` is capped at 20; increase limit or paginate

## Polish

- **Review page scope** — currently shows all-time mistakes; consider filtering to the most recent quiz session only
- **Explanation coverage** — many questions have `explanation_he = null`; populate or remove the field
- **Image fallback** — questions with missing images are silently filtered out; show a placeholder instead
