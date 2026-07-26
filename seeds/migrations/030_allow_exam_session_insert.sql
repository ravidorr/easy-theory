BEGIN;

-- Authenticated learners may create only their own persisted exam sessions.
-- Updates and finalization remain constrained to the server-side RPCs.
CREATE POLICY "own insert" ON public.user_exam_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (30, '030_allow_exam_session_insert.sql', '4c1a8b03cd33de4a7a27affceb41fa2662044047cbb5bbbf2e74c48f44a6ca8b');

COMMIT;
