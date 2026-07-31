BEGIN;

ALTER TABLE public.content_source_releases
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'question_bank'
    CHECK (source_kind IN ('question_bank', 'sign_catalog')),
  ADD COLUMN IF NOT EXISTS revision_id TEXT;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS source_release_id UUID REFERENCES public.content_source_releases(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS explanation_he_source_url TEXT,
  ADD COLUMN IF NOT EXISTS explanation_ar_source_url TEXT;

ALTER TABLE public.signs
  ADD COLUMN IF NOT EXISTS source_release_id UUID REFERENCES public.content_source_releases(id),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.user_exam_sessions
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS questions_active_topic_number_idx
  ON public.questions (topic_id, question_number)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS signs_active_number_idx
  ON public.signs (sign_number)
  WHERE is_active;

-- Do not allow a client to record new answers for content retired by a later
-- approved release. Historical answers remain intact for learner history.
CREATE OR REPLACE FUNCTION public.reject_inactive_question_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.questions WHERE id = NEW.question_id AND is_active
  ) THEN
    RAISE EXCEPTION 'question_inactive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_quiz_responses_require_active_question ON public.user_quiz_responses;
CREATE TRIGGER user_quiz_responses_require_active_question
  BEFORE INSERT OR UPDATE ON public.user_quiz_responses
  FOR EACH ROW EXECUTE FUNCTION public.reject_inactive_question_response();

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
  WHERE user_id = v_user_id AND submitted_at IS NULL AND invalidated_at IS NULL AND expires_at > NOW()
  ORDER BY started_at DESC
  LIMIT 1;
  IF FOUND THEN RETURN v_session; END IF;

  SELECT array_agg(id) INTO v_question_ids
  FROM (
    SELECT id FROM public.questions WHERE is_active ORDER BY random() LIMIT 30
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

REVOKE ALL ON FUNCTION public.reject_inactive_question_response() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_exam_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_exam_session() TO authenticated;

-- Finalization intentionally allows expiry for answers saved before the timer
-- elapsed, but a content cutover is different: its question set is retired.
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
  IF v_session.invalidated_at IS NOT NULL THEN RAISE EXCEPTION 'exam_session_invalidated'; END IF;
  IF v_session.result IS NOT NULL THEN RETURN v_session.result; END IF;

  WITH scored AS (
    SELECT q.id AS question_id, q.topic_id, q.correct_option,
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
    FROM result_rows GROUP BY topic_id
  ), aggregate_result AS (
    SELECT COUNT(*) FILTER (WHERE is_correct) AS score,
      COUNT(*) FILTER (WHERE selected_option IS NULL) AS unanswered_count,
      COALESCE(jsonb_agg(jsonb_build_object(
        'question_id', question_id, 'selected_option', selected_option,
        'correct_option', correct_option, 'is_correct', is_correct
      ) ORDER BY question_id) FILTER (WHERE selected_option IS NOT NULL), '[]'::JSONB) AS results
    FROM result_rows
  )
  SELECT jsonb_build_object(
    'score', score, 'total', 30, 'passed', score >= 26, 'pass_mark', 26,
    'results', results,
    'duration_seconds', GREATEST(0, LEAST(EXTRACT(EPOCH FROM (NOW() - v_session.started_at))::INT, EXTRACT(EPOCH FROM (v_session.expires_at - v_session.started_at))::INT)),
    'unanswered_count', unanswered_count,
    'topic_breakdown', (SELECT COALESCE(jsonb_object_agg(topic_id, value), '{}'::JSONB) FROM topic_summary)
  ) INTO v_result FROM aggregate_result;

  INSERT INTO public.user_exam_attempts (user_id, score, total, passed, answers, duration_seconds)
  VALUES (v_user_id, (v_result ->> 'score')::INT, 30, (v_result ->> 'passed')::BOOLEAN,
    v_result -> 'results', (v_result ->> 'duration_seconds')::INT)
  RETURNING id INTO v_attempt_id;

  UPDATE public.user_exam_sessions
  SET submitted_at = NOW(), attempt_id = v_attempt_id, result = v_result
  WHERE id = p_session_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_exam_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_exam_session(UUID) TO authenticated;

-- A release writer first assigns every approved row to the two source
-- releases, then calls this once. Locking and a single transaction prevent a
-- learner from receiving a question/sign mix across releases.
CREATE OR REPLACE FUNCTION public.publish_content_release(
  p_question_release_id UUID,
  p_sign_release_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.content_source_releases
    WHERE id = p_question_release_id AND source_kind = 'question_bank'
  ) THEN RAISE EXCEPTION 'invalid_question_release'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.content_source_releases
    WHERE id = p_sign_release_id AND source_kind = 'sign_catalog'
  ) THEN RAISE EXCEPTION 'invalid_sign_release'; END IF;

  LOCK TABLE public.questions, public.signs, public.user_exam_sessions IN SHARE ROW EXCLUSIVE MODE;

  UPDATE public.questions
  SET is_active = (source_release_id = p_question_release_id)
  WHERE source_release_id IS NOT NULL;
  UPDATE public.questions
  SET explanation_he = CASE WHEN explanation_he_source_url IS NULL THEN NULL ELSE explanation_he END,
      explanation_ar = CASE WHEN explanation_ar_source_url IS NULL THEN NULL ELSE explanation_ar END
  WHERE source_release_id = p_question_release_id;
  UPDATE public.signs
  SET is_active = (source_release_id = p_sign_release_id)
  WHERE source_release_id IS NOT NULL;

  -- Existing sessions must not bridge the content cutover.
  UPDATE public.user_exam_sessions
  SET expires_at = NOW(), invalidated_at = NOW()
  WHERE submitted_at IS NULL AND expires_at > NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.publish_content_release(UUID, UUID) FROM PUBLIC;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (36, '036_content_release_provenance.sql', '13a2a7871b028a759fb076d288fd3804b4b26bddf4aa0597ce9d65c8f76c9f0b');

COMMIT;
