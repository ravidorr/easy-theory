BEGIN;

-- Store a diagnostic attempt and its learner plan in one transaction so the
-- API never reports a saved plan after a partial write.
CREATE OR REPLACE FUNCTION public.complete_diagnostic(
  p_answers JSONB,
  p_topic_scores JSONB,
  p_target_exam_date DATE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.user_diagnostic_attempts (user_id, answers, topic_scores)
  VALUES (v_user_id, p_answers, p_topic_scores);

  INSERT INTO public.user_learner_plans (
    user_id, target_exam_date, diagnostic_completed_at, updated_at
  ) VALUES (
    v_user_id, p_target_exam_date, NOW(), NOW()
  ) ON CONFLICT (user_id) DO UPDATE
  SET
    target_exam_date = EXCLUDED.target_exam_date,
    diagnostic_completed_at = EXCLUDED.diagnostic_completed_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_diagnostic(JSONB, JSONB, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_diagnostic(JSONB, JSONB, DATE) TO authenticated;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (32, '032_atomic_diagnostic_completion.sql', 'b8242e068655d073d4a59908b71223525d041851a4084ca7d876dced360fa6bf');

COMMIT;
