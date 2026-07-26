BEGIN;

-- Every claim shown to learners is tied to an import release, rather than an
-- unverified editorial date.
CREATE TABLE public.content_source_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  resource_url TEXT NOT NULL,
  source_checksum TEXT NOT NULL CHECK (source_checksum ~ '^[0-9a-f]{64}$'),
  importer_version TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resource_url, source_checksum)
);

INSERT INTO public.content_source_releases (
  source_name, resource_url, source_checksum, importer_version, imported_at
) VALUES (
  'מאגר השאלות והתשובות הרשמי למבחן נהיגה עיוני ממוחשב, משרד התחבורה והבטיחות בדרכים',
  'https://data.gov.il/dataset/618dd157-8df3-43e7-bf9a-00974b4919e9/resource/8c0f314f-583d-48b6-9f5f-4483d95f6848/download/theoryexamhe-data.xml',
  '2e62afd833a5615eb16348b98df3b81e9498084f743d05d5990cf6c27c70e1b7',
  'scripts/parse_questions.py',
  NOW()
) ON CONFLICT (resource_url, source_checksum) DO NOTHING;

-- An exam session is server-owned so a refresh cannot silently replace its
-- question set or reset its timer.
CREATE TABLE public.user_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_ids UUID[] NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  marked_question_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  current_index INT NOT NULL DEFAULT 0 CHECK (current_index >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  attempt_id UUID REFERENCES public.user_exam_attempts(id),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, id)
);

ALTER TABLE public.content_source_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.content_source_releases FOR SELECT USING (true);
GRANT SELECT ON public.content_source_releases TO anon, authenticated;
CREATE INDEX user_exam_sessions_active_idx
  ON public.user_exam_sessions (user_id, expires_at)
  WHERE submitted_at IS NULL;

CREATE TABLE public.user_learner_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_exam_date DATE,
  daily_question_goal INT NOT NULL DEFAULT 20 CHECK (daily_question_goal BETWEEN 5 AND 100),
  diagnostic_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_diagnostic_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  topic_scores JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_answer_confidence (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  confidence TEXT NOT NULL CHECK (confidence IN ('sure', 'unsure', 'guessed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

ALTER TABLE public.question_reports
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'unclear'
    CHECK (category IN ('unclear', 'wrong_answer', 'outdated', 'image', 'wording')),
  ADD COLUMN IF NOT EXISTS source_checksum TEXT;

ALTER TABLE public.user_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learner_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_diagnostic_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answer_confidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select" ON public.user_exam_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own select" ON public.user_learner_plans FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own select" ON public.user_diagnostic_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own select" ON public.user_answer_confidence FOR SELECT USING (user_id = auth.uid());

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (28, '028_readiness_foundations.sql', 'a03680c40ba7441cf1a1dbed9503db4a8812724b60f2250051270aa7ecca1c1f');

COMMIT;
