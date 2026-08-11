BEGIN;

-- PostgreSQL has jsonb_typeof(), not typeof(); redeploy the submission RPC
-- without changing already-applied migration 039.
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
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
  v_result JSONB;
  v_is_replay BOOLEAN := FALSE;
  v_was_topic_completed BOOLEAN := FALSE;
  v_active_question_count INT := 0;
  v_active_correct_response_count INT := 0;
  v_srs_ease DOUBLE PRECISION := 2.5;
  v_srs_interval_days INT := 0;
  v_srs_repetitions INT := 0;
  v_srs_reviewed_at TIMESTAMPTZ := NOW();
  v_topic_count INT;
  v_completed_topic_count INT;
  v_medal_slug TEXT;
  v_result_changed BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT || ':achievements', 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.quiz_answer_submissions
    WHERE user_id = v_user_id
      AND idempotency_key = p_idempotency_key
  ) INTO v_is_replay;

  IF p_topic_id IS NOT NULL THEN
    SELECT status = 'completed'
    INTO v_was_topic_completed
    FROM public.user_topic_progress
    WHERE user_id = v_user_id
      AND topic_id = p_topic_id;
    v_was_topic_completed := COALESCE(v_was_topic_completed, FALSE);
  END IF;

  v_result := public.submit_quiz_answer_internal(
    p_idempotency_key,
    p_question_id,
    p_selected_option,
    p_topic_id,
    p_session_id
  );

  -- The card update shares the submission transaction. A database failure
  -- rolls back the answer claim too, so the same idempotency key can retry
  -- safely without either losing or double-applying the review.
  IF NOT v_is_replay
     AND jsonb_typeof(v_result -> 'is_correct') = 'boolean' THEN
    SELECT ease, interval_days, repetitions
    INTO v_srs_ease, v_srs_interval_days, v_srs_repetitions
    FROM public.user_srs_cards
    WHERE user_id = v_user_id
      AND question_id = p_question_id
    FOR UPDATE;

    v_srs_ease := COALESCE(v_srs_ease, 2.5);
    v_srs_interval_days := COALESCE(v_srs_interval_days, 0);
    v_srs_repetitions := COALESCE(v_srs_repetitions, 0);

    IF (v_result ->> 'is_correct')::BOOLEAN THEN
      v_srs_repetitions := v_srs_repetitions + 1;
      v_srs_interval_days := CASE
        WHEN v_srs_repetitions = 1 THEN 1
        WHEN v_srs_repetitions = 2 THEN 6
        ELSE ROUND(v_srs_interval_days * v_srs_ease)::INT
      END;
    ELSE
      v_srs_ease := GREATEST(1.3::DOUBLE PRECISION, v_srs_ease - 0.2);
      v_srs_interval_days := 0;
      v_srs_repetitions := 0;
    END IF;

    INSERT INTO public.user_srs_cards (
      user_id,
      question_id,
      ease,
      interval_days,
      repetitions,
      due_at,
      last_reviewed_at
    ) VALUES (
      v_user_id,
      p_question_id,
      v_srs_ease,
      v_srs_interval_days,
      v_srs_repetitions,
      v_srs_reviewed_at + v_srs_interval_days * INTERVAL '1 day',
      v_srs_reviewed_at
    )
    ON CONFLICT (user_id, question_id) DO UPDATE
    SET
      ease = EXCLUDED.ease,
      interval_days = EXCLUDED.interval_days,
      repetitions = EXCLUDED.repetitions,
      due_at = EXCLUDED.due_at,
      last_reviewed_at = EXCLUDED.last_reviewed_at;
  END IF;

  IF p_topic_id IS NOT NULL
     AND COALESCE((v_result ->> 'is_correct')::BOOLEAN, FALSE) THEN
    SELECT COUNT(*)
    INTO v_active_question_count
    FROM public.questions
    WHERE topic_id = p_topic_id
      AND is_active;

    SELECT COUNT(DISTINCT responses.question_id)
    INTO v_active_correct_response_count
    FROM public.user_quiz_responses AS responses
    INNER JOIN public.questions
      ON questions.id = responses.question_id
    WHERE responses.user_id = v_user_id
      AND responses.is_correct = TRUE
      AND questions.topic_id = p_topic_id
      AND questions.is_active;

    IF v_active_question_count > 0
       AND v_active_correct_response_count = v_active_question_count
       AND NOT v_was_topic_completed THEN
      UPDATE public.user_topic_progress
      SET status = 'completed', last_studied_at = NOW()
      WHERE user_id = v_user_id
        AND topic_id = p_topic_id
        AND status <> 'completed';

      v_result := jsonb_set(v_result, '{topic_completed}', 'true'::JSONB);
      v_result_changed := TRUE;
    END IF;
  END IF;

  IF COALESCE((v_result ->> 'topic_completed')::BOOLEAN, FALSE) THEN
    SELECT COUNT(*)
    INTO v_topic_count
    FROM public.topics AS topics
    WHERE EXISTS (
      SELECT 1
      FROM public.questions
      WHERE topic_id = topics.id
        AND is_active
    );

    SELECT COUNT(*)
    INTO v_completed_topic_count
    FROM public.topics AS topics
    WHERE EXISTS (
      SELECT 1
      FROM public.questions
      WHERE topic_id = topics.id
        AND is_active
    )
      AND NOT EXISTS (
        SELECT 1
        FROM public.questions AS questions
        LEFT JOIN public.user_quiz_responses AS responses
          ON responses.question_id = questions.id
          AND responses.user_id = v_user_id
        WHERE questions.topic_id = topics.id
          AND questions.is_active
          AND (responses.id IS NULL OR responses.is_correct IS NOT TRUE)
      );

    IF v_completed_topic_count = 1 THEN
      v_medal_slug := NULL;
      INSERT INTO public.user_medals (user_id, medal_slug)
      VALUES (v_user_id, 'first-topic')
      ON CONFLICT (user_id, medal_slug) DO NOTHING
      RETURNING medal_slug INTO v_medal_slug;

      IF v_medal_slug IS NOT NULL THEN
        v_result := jsonb_set(
          v_result,
          '{medals_earned}',
          COALESCE(v_result -> 'medals_earned', '[]'::JSONB)
            || jsonb_build_array(v_medal_slug)
        );
        v_result_changed := TRUE;
      END IF;
    END IF;

    IF v_topic_count > 0 AND v_completed_topic_count >= v_topic_count THEN
      v_medal_slug := NULL;
      INSERT INTO public.user_medals (user_id, medal_slug)
      VALUES (v_user_id, 'all-topics')
      ON CONFLICT (user_id, medal_slug) DO NOTHING
      RETURNING medal_slug INTO v_medal_slug;

      IF v_medal_slug IS NOT NULL THEN
        v_result := jsonb_set(
          v_result,
          '{medals_earned}',
          COALESCE(v_result -> 'medals_earned', '[]'::JSONB)
            || jsonb_build_array(v_medal_slug)
        );
        v_result_changed := TRUE;
      END IF;
    END IF;
  END IF;

  IF v_result_changed THEN
    UPDATE public.quiz_answer_submissions
    SET result = v_result
    WHERE user_id = v_user_id
      AND idempotency_key = p_idempotency_key;
  END IF;

  -- This response-only marker lets callers distinguish a replay without
  -- changing the stored quiz result.
  RETURN jsonb_set(v_result, '{is_new_submission}', to_jsonb(NOT v_is_replay));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  TO authenticated;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (40, '040_fix_quiz_srs_jsonb_type.sql', 'fcc61f523df635a7bd324e49e0bc2bc3d32b29a20fb28d54ea055da138914763');

COMMIT;
