-- Question bookmarks — one row per (user, question) the user saved for later.
-- Toggling is insert/delete only, so no UPDATE policy is needed.
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS user_question_bookmarks (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

ALTER TABLE user_question_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON user_question_bookmarks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_question_bookmarks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON user_question_bookmarks FOR DELETE USING (user_id = auth.uid());
