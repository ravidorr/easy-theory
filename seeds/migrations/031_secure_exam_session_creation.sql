BEGIN;

-- Sessions are created only by this RPC. The learner may never choose the
-- questions, answers, timer, or owner used to calculate a passing result.
DROP POLICY IF EXISTS "own insert" ON public.user_exam_sessions;

CREATE OR REPLACE FUNCTION public.create_exam_session()
RETURNS public.user_exam_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session public.user_exam_sessions%ROWTYPE;
  v_question_ids UUID[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT));

  SELECT * INTO v_session
  FROM public.user_exam_sessions
  WHERE user_id = v_user_id AND submitted_at IS NULL AND expires_at > NOW()
  ORDER BY started_at DESC
  LIMIT 1;
  IF FOUND THEN RETURN v_session; END IF;

  SELECT array_agg(id) INTO v_question_ids
  FROM (
    SELECT id FROM public.questions ORDER BY random() LIMIT 30
  ) AS sampled_questions;
  IF coalesce(array_length(v_question_ids, 1), 0) <> 30 THEN
    RAISE EXCEPTION 'exam_questions_unavailable';
  END IF;

  INSERT INTO public.user_exam_sessions (user_id, question_ids, expires_at)
  VALUES (v_user_id, v_question_ids, NOW() + INTERVAL '40 minutes')
  RETURNING * INTO v_session;
  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.create_exam_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_exam_session() TO authenticated;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (31, '031_secure_exam_session_creation.sql', 'b0a60048f635e7f568574320814ed0e0b21258e46b14ca6de719a2702812d961');

COMMIT;
