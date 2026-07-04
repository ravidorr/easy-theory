-- Prevent a user from earning stars multiple times for the same question.
-- Run this once against the production database after deploying the deduplication
-- logic in /api/quiz/route.ts.
--
-- If duplicate rows already exist, remove them first:
--   DELETE FROM user_quiz_responses a
--   USING user_quiz_responses b
--   WHERE a.id > b.id
--     AND a.user_id = b.user_id
--     AND a.question_id = b.question_id;

ALTER TABLE user_quiz_responses
  ADD CONSTRAINT uq_user_question UNIQUE (user_id, question_id);
