BEGIN;

ALTER TABLE public.user_exam_sessions
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);

-- The only mutation path for an in-progress session. A matching revision
-- makes a stale full-state snapshot harmless, and the expiry predicate keeps
-- late browser writes out of a timed exam.
CREATE OR REPLACE FUNCTION public.update_exam_session(
  p_session_id UUID,
  p_revision INTEGER,
  p_answers JSONB,
  p_current_index INTEGER,
  p_marked_question_ids UUID[]
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_revision INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_revision < 0 OR p_current_index NOT BETWEEN 0 AND 29 THEN
    RAISE EXCEPTION 'invalid_exam_session_update';
  END IF;

  UPDATE public.user_exam_sessions
  SET
    answers = p_answers,
    current_index = p_current_index,
    marked_question_ids = p_marked_question_ids,
    revision = revision + 1
  WHERE id = p_session_id
    AND user_id = v_user_id
    AND revision = p_revision
    AND submitted_at IS NULL
    AND expires_at > NOW()
  RETURNING revision INTO v_revision;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.user_exam_sessions
      WHERE id = p_session_id AND user_id = v_user_id AND submitted_at IS NULL AND expires_at <= NOW()
    ) THEN
      RAISE EXCEPTION 'exam_session_expired';
    END IF;
    RAISE EXCEPTION 'exam_session_conflict';
  END IF;
  RETURN v_revision;
END;
$$;

-- Locks, scores, records the attempt, and stores its replay result in one
-- transaction. Late finalization is allowed only for answers saved before
-- expiry; update_exam_session rejects any later answer mutation.
CREATE OR REPLACE FUNCTION public.finalize_exam_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session public.user_exam_sessions%ROWTYPE;
  v_result JSONB;
  v_attempt_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_session
  FROM public.user_exam_sessions
  WHERE id = p_session_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exam_session_not_found'; END IF;
  IF v_session.result IS NOT NULL THEN RETURN v_session.result; END IF;

  WITH scored AS (
    SELECT
      q.id AS question_id,
      q.topic_id,
      q.correct_option,
      v_session.answers ->> q.id::TEXT AS selected_option
    FROM unnest(v_session.question_ids) AS ids(question_id)
    JOIN public.questions AS q ON q.id = ids.question_id
  ), result_rows AS (
    SELECT question_id, topic_id, selected_option, correct_option,
      selected_option IS NOT NULL AND selected_option = correct_option AS is_correct
    FROM scored
  ), topic_summary AS (
    SELECT topic_id::TEXT AS topic_id,
      jsonb_build_object('correct', SUM(is_correct::INT), 'total', COUNT(*)) AS value
    FROM result_rows
    GROUP BY topic_id
  ), aggregate_result AS (
    SELECT
      COUNT(*) FILTER (WHERE is_correct) AS score,
      COUNT(*) FILTER (WHERE selected_option IS NULL) AS unanswered_count,
      COALESCE(jsonb_agg(jsonb_build_object(
        'question_id', question_id,
        'selected_option', selected_option,
        'correct_option', correct_option,
        'is_correct', is_correct
      ) ORDER BY question_id) FILTER (WHERE selected_option IS NOT NULL), '[]'::JSONB) AS results
    FROM result_rows
  )
  SELECT jsonb_build_object(
    'score', score,
    'total', 30,
    'passed', score >= 26,
    'pass_mark', 26,
    'results', results,
    'duration_seconds', GREATEST(0, LEAST(EXTRACT(EPOCH FROM (NOW() - v_session.started_at))::INT, EXTRACT(EPOCH FROM (v_session.expires_at - v_session.started_at))::INT)),
    'unanswered_count', unanswered_count,
    'topic_breakdown', (SELECT COALESCE(jsonb_object_agg(topic_id, value), '{}'::JSONB) FROM topic_summary)
  ) INTO v_result FROM aggregate_result;

  INSERT INTO public.user_exam_attempts (user_id, score, total, passed, answers, duration_seconds)
  VALUES (
    v_user_id,
    (v_result ->> 'score')::INT,
    30,
    (v_result ->> 'passed')::BOOLEAN,
    v_result -> 'results',
    (v_result ->> 'duration_seconds')::INT
  ) RETURNING id INTO v_attempt_id;

  UPDATE public.user_exam_sessions
  SET submitted_at = NOW(), attempt_id = v_attempt_id, result = v_result
  WHERE id = p_session_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_exam_session(UUID, INTEGER, JSONB, INTEGER, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_exam_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_exam_session(UUID, INTEGER, JSONB, INTEGER, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_exam_session(UUID) TO authenticated;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (29, '029_harden_exam_sessions.sql', '18d293bf38e3b08408c9e9c336972445080e4a0de7260f70a56f1b4296f7b0b3');

COMMIT;
