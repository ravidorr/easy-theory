-- Spaced-repetition (SM-2) state per user per item — one row per
-- (user, sign) or (user, question). Exactly one of sign_id/question_id is set.
-- Plain UNIQUE constraints (not partial indexes) so PostgREST upserts can
-- target them via on_conflict; NULLs are distinct so the two never collide.
-- Run once in the Supabase SQL editor (production AND QA projects).

CREATE TABLE IF NOT EXISTS user_srs_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sign_id          UUID REFERENCES signs(id) ON DELETE CASCADE,
  question_id      UUID REFERENCES questions(id) ON DELETE CASCADE,
  -- DOUBLE PRECISION, not REAL: the CHECK compares in double precision, and
  -- the SM-2 floor value 1.3 stored as REAL rounds to 1.29999995..., which
  -- would violate the constraint it is meant to satisfy.
  ease             DOUBLE PRECISION NOT NULL DEFAULT 2.5 CHECK (ease >= 1.3),
  interval_days    INT  NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  repetitions      INT  NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  due_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((sign_id IS NULL) <> (question_id IS NULL)),
  UNIQUE (user_id, sign_id),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS user_srs_cards_user_due_idx
  ON user_srs_cards (user_id, due_at);

ALTER TABLE user_srs_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own select" ON user_srs_cards;
DROP POLICY IF EXISTS "own insert" ON user_srs_cards;
DROP POLICY IF EXISTS "own update" ON user_srs_cards;
CREATE POLICY "own select" ON user_srs_cards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_srs_cards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON user_srs_cards FOR UPDATE USING (user_id = auth.uid());
