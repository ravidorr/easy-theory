BEGIN;

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL CHECK (topic IN ('question', 'bug', 'idea', 'general')),
  message     TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  reply_email TEXT,
  locale      TEXT NOT NULL CHECK (locale IN ('he', 'ar')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Contact messages are written only through the server route's service-role
-- client; end users never receive a direct table policy.

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (25, '025_contact_messages.sql', '5578a47115319b1dddb1bd4ae612afa96a9451e9cf19da30e53be55be79a51b3');

COMMIT;
