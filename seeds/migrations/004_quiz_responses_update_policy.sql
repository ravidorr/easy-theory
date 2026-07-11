-- Allow users to update their own quiz responses so that retaking a quiz
-- correctly overwrites a previously wrong answer via the upsert in /api/quiz/route.ts.
-- Without this policy, the ON CONFLICT DO UPDATE path was blocked by RLS,
-- leaving stale wrong answers in the database and causing the review page to
-- show the old wrong selection even after the user answered correctly.
CREATE POLICY "own update" ON user_quiz_responses
  FOR UPDATE USING (user_id = auth.uid());
