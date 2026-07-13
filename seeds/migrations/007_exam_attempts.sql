-- Mock-exam attempt history — one row per completed exam run.
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS user_exam_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  score            INT NOT NULL CHECK (score >= 0),
  total            INT NOT NULL CHECK (total > 0),
  passed           BOOLEAN NOT NULL,
  answers          JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds INT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CHECK (score <= total)
);

ALTER TABLE user_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON user_exam_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_exam_attempts FOR INSERT WITH CHECK (user_id = auth.uid());
