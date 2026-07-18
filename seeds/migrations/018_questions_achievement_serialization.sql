-- Keep the 100-question achievement in the serialized submission path. The
-- API cannot safely infer an exact crossing after two submissions commit.

ALTER FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  RENAME TO submit_quiz_answer_internal;

CREATE FUNCTION public.submit_quiz_answer(
  p_idempotency_key TEXT,
  p_question_id UUID,
  p_selected_option TEXT,
  p_topic_id UUID DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_response_existed BOOLEAN := FALSE;
  v_result JSONB;
  v_answer_count INT;
  v_medal_slug TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- All submissions for one learner share this lock, so the post-insert count
  -- observes every preceding answer and the 100th crossing cannot be skipped.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT || ':achievements', 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.user_quiz_responses
    WHERE user_id = v_user_id
      AND question_id = p_question_id
  ) INTO v_response_existed;

  v_result := public.submit_quiz_answer_internal(
    p_idempotency_key,
    p_question_id,
    p_selected_option,
    p_topic_id,
    p_session_id
  );

  -- Only a newly inserted response can cross the distinct-question threshold;
  -- answer changes and historical accounts are deliberately not backfilled.
  IF NOT v_response_existed THEN
    SELECT COUNT(*)
    INTO v_answer_count
    FROM public.user_quiz_responses
    WHERE user_id = v_user_id;

    IF v_answer_count = 100 THEN
      v_medal_slug := NULL;
      INSERT INTO public.user_medals (user_id, medal_slug)
      VALUES (v_user_id, 'questions-100')
      ON CONFLICT (user_id, medal_slug) DO NOTHING
      RETURNING medal_slug INTO v_medal_slug;

      IF v_medal_slug IS NOT NULL THEN
        v_result := jsonb_set(
          v_result,
          '{medals_earned}',
          COALESCE(v_result -> 'medals_earned', '[]'::JSONB)
            || jsonb_build_array(v_medal_slug)
        );
        UPDATE public.quiz_answer_submissions
        SET result = v_result
        WHERE user_id = v_user_id
          AND idempotency_key = p_idempotency_key;
      END IF;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz_answer_internal(TEXT, UUID, TEXT, UUID, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_quiz_answer_internal(TEXT, UUID, TEXT, UUID, UUID)
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  TO authenticated;
