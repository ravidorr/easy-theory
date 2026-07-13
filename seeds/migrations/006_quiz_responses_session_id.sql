-- Adds a per-quiz-run session identifier so the review/retry pages can scope
-- mistakes to the user's most recent practice run. Legacy rows keep NULL and
-- are treated as one implicit all-time session by getMistakesForTopic.
ALTER TABLE user_quiz_responses
  ADD COLUMN IF NOT EXISTS session_id UUID;
