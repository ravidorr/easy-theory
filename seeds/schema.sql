-- ClearRoad · דרך ברורה — Supabase schema
-- Run this in the Supabase SQL editor before seeding data.

-- ── Content tables (publicly readable) ───────────────────────

CREATE TABLE IF NOT EXISTS topics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,
  name_he        TEXT NOT NULL,
  description_he TEXT,
  order_index    INT NOT NULL,
  icon           TEXT   -- sign image path e.g. /signs/sign-302.png
);

CREATE TABLE IF NOT EXISTS questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        UUID REFERENCES topics(id),
  question_number INT UNIQUE,
  question_he     TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_option  CHAR(1) CHECK (correct_option IN ('a','b','c','d')),
  image_url       TEXT,        -- local path /questions/3{number}.jpg
  license_types   TEXT[],
  explanation_he  TEXT         -- null for now; quiz hides row when null
);

CREATE TABLE IF NOT EXISTS signs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sign_number TEXT NOT NULL,
  name_he     TEXT NOT NULL,
  meaning_he  TEXT,
  image_path  TEXT NOT NULL,  -- /signs/sign-{number}.png
  category    TEXT
);

-- ── User tables (RLS protected) ───────────────────────────────

CREATE TABLE IF NOT EXISTS user_stats (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  star_points      INT DEFAULT 0,
  streak_days      INT DEFAULT 0,
  last_active_date DATE
);

CREATE TABLE IF NOT EXISTS user_medals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  medal_slug TEXT NOT NULL,
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, medal_slug)
);

CREATE TABLE IF NOT EXISTS user_schedule (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week      INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TIME NOT NULL,
  duration_minutes INT DEFAULT 45,
  notify           BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_topic_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id        UUID REFERENCES topics(id),
  status          TEXT DEFAULT 'not_started'
                    CHECK (status IN ('not_started','in_progress','completed')),
  last_studied_at TIMESTAMPTZ,
  best_score      INT,
  UNIQUE(user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS user_quiz_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id     UUID REFERENCES questions(id),
  selected_option CHAR(1),
  is_correct      BOOLEAN NOT NULL,
  answered_at     TIMESTAMPTZ DEFAULT NOW(),
  session_id      UUID,
  UNIQUE(user_id, question_id)
);

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

CREATE TABLE IF NOT EXISTS user_question_bookmarks (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- Added in migration 014 — SM-2 spaced-repetition state per (user, sign) or
-- (user, question); exactly one of sign_id/question_id is set.
CREATE TABLE IF NOT EXISTS user_srs_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sign_id          UUID REFERENCES signs(id) ON DELETE CASCADE,
  question_id      UUID REFERENCES questions(id) ON DELETE CASCADE,
  -- DOUBLE PRECISION, not REAL: the CHECK compares in double precision, and
  -- the SM-2 floor value 1.3 stored as REAL rounds below the 1.3 literal.
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

CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  auth       TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE user_stats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_medals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_schedule      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signs     ENABLE ROW LEVEL SECURITY;

-- Content: anyone authenticated can read
CREATE POLICY "public read" ON topics    FOR SELECT USING (true);
CREATE POLICY "public read" ON questions FOR SELECT USING (true);
CREATE POLICY "public read" ON signs     FOR SELECT USING (true);

-- User tables: own rows only
CREATE POLICY "own select" ON user_stats          FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_stats          FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON user_stats          FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "own select" ON user_medals         FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "own select" ON user_schedule       FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_schedule       FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON user_schedule       FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own delete" ON user_schedule       FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "own select" ON user_topic_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_topic_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON user_topic_progress FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "own select" ON user_quiz_responses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_quiz_responses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON user_quiz_responses FOR UPDATE USING (user_id = auth.uid());

ALTER TABLE user_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON user_push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON user_push_subscriptions FOR DELETE USING (user_id = auth.uid());

ALTER TABLE user_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON user_exam_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_exam_attempts FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE user_question_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON user_question_bookmarks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_question_bookmarks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete" ON user_question_bookmarks FOR DELETE USING (user_id = auth.uid());

ALTER TABLE user_srs_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON user_srs_cards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own insert" ON user_srs_cards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON user_srs_cards FOR UPDATE USING (user_id = auth.uid());
