BEGIN;

CREATE TABLE IF NOT EXISTS public.question_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  comment     TEXT CHECK (comment IS NULL OR char_length(comment) BETWEEN 1 AND 1000),
  locale      TEXT NOT NULL CHECK (locale IN ('he', 'ar')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id)
);

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

-- Question reports are written only through the server route's service-role
-- client; end users never receive a direct table policy.

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (26, '026_question_reports.sql', '40ee41fadc0790773a757e42962446b677845ef321598bd5030c7530efb2ea7d');

COMMIT;
