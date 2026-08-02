BEGIN;

-- Some production ledgers recorded migration 026 without the table reaching
-- the database. Recreate the reporting storage in a later migration so the
-- normal runner can repair that state without replaying historical entries.
CREATE TABLE IF NOT EXISTS public.question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) BETWEEN 1 AND 1000),
  locale TEXT NOT NULL CHECK (locale IN ('he', 'ar')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL DEFAULT 'unclear'
    CHECK (category IN ('unclear', 'wrong_answer', 'outdated', 'image', 'wording')),
  source_checksum TEXT,
  UNIQUE (user_id, question_id)
);

-- Keep databases where v26 did create the table compatible with the columns
-- introduced by v28.
ALTER TABLE public.question_reports
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'unclear'
    CHECK (category IN ('unclear', 'wrong_answer', 'outdated', 'image', 'wording')),
  ADD COLUMN IF NOT EXISTS source_checksum TEXT;

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (38, '038_repair_question_reports.sql', 'de40277162affb7c6e13a2d6a733317a12c250298696f98fad0dbc6d6e55f5a3');

COMMIT;
