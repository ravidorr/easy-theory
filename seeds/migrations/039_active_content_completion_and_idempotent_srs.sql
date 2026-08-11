BEGIN;

-- Content releases retain retired questions for learner history, but current
-- completion and achievement calculations must consider only the active bank.
CREATE OR REPLACE FUNCTION public.reconcile_topic_progress_for_active_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_topic_progress AS progress
  SET status = 'in_progress'
  WHERE progress.status = 'completed'
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.questions AS active_questions
        WHERE active_questions.topic_id = progress.topic_id
          AND active_questions.is_active
      )
      OR EXISTS (
        SELECT 1
        FROM public.questions AS questions
        LEFT JOIN public.user_quiz_responses AS responses
          ON responses.user_id = progress.user_id
          AND responses.question_id = questions.id
        WHERE questions.topic_id = progress.topic_id
          AND questions.is_active
          AND (responses.id IS NULL OR responses.is_correct IS NOT TRUE)
      )
    );

  WITH active_topic_completions AS (
    SELECT
      responses.user_id,
      questions.topic_id
    FROM public.questions
    INNER JOIN public.user_quiz_responses AS responses
      ON responses.question_id = questions.id
    WHERE questions.is_active
    GROUP BY responses.user_id, questions.topic_id
    HAVING BOOL_AND(responses.is_correct)
      AND COUNT(*) = (
        SELECT COUNT(*)
        FROM public.questions AS active_questions
        WHERE active_questions.topic_id = questions.topic_id
          AND active_questions.is_active
      )
  )
  INSERT INTO public.user_topic_progress (user_id, topic_id, status, last_studied_at)
  SELECT user_id, topic_id, 'completed', NOW()
  FROM active_topic_completions
  ON CONFLICT (user_id, topic_id) DO UPDATE
  SET status = 'completed', last_studied_at = EXCLUDED.last_studied_at
  WHERE user_topic_progress.status <> 'completed';

  INSERT INTO public.user_medals (user_id, medal_slug)
  SELECT DISTINCT user_id, 'first-topic'
  FROM public.user_topic_progress
  WHERE status = 'completed'
  ON CONFLICT (user_id, medal_slug) DO NOTHING;

  INSERT INTO public.user_medals (user_id, medal_slug)
  SELECT DISTINCT progress.user_id, 'all-topics'
  FROM public.user_topic_progress AS progress
  WHERE progress.status = 'completed'
    AND EXISTS (
      SELECT 1
      FROM public.topics AS topics
      WHERE EXISTS (
        SELECT 1
        FROM public.questions
        WHERE topic_id = topics.id
          AND is_active
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.topics AS topics
      WHERE EXISTS (
        SELECT 1
        FROM public.questions
        WHERE topic_id = topics.id
          AND is_active
      )
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_topic_progress AS completed_progress
          WHERE completed_progress.user_id = progress.user_id
            AND completed_progress.topic_id = topics.id
            AND completed_progress.status = 'completed'
        )
    )
  ON CONFLICT (user_id, medal_slug) DO NOTHING;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reconcile_topic_progress_for_active_questions ON public.questions;
CREATE TRIGGER reconcile_topic_progress_for_active_questions
AFTER UPDATE OF is_active ON public.questions
FOR EACH STATEMENT
EXECUTE FUNCTION public.reconcile_topic_progress_for_active_questions();
REVOKE ALL ON FUNCTION public.reconcile_topic_progress_for_active_questions() FROM PUBLIC;

-- Bring existing progress into the same active-bank state before restoring
-- completions that became possible after retired questions were removed.
UPDATE public.user_topic_progress AS progress
SET status = 'in_progress'
WHERE progress.status = 'completed'
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.questions AS active_questions
      WHERE active_questions.topic_id = progress.topic_id
        AND active_questions.is_active
    )
    OR EXISTS (
      SELECT 1
      FROM public.questions AS active_questions
      LEFT JOIN public.user_quiz_responses AS responses
        ON responses.user_id = progress.user_id
        AND responses.question_id = active_questions.id
      WHERE active_questions.topic_id = progress.topic_id
        AND active_questions.is_active
        AND (responses.id IS NULL OR responses.is_correct IS NOT TRUE)
    )
  );

WITH active_topic_completions AS (
  SELECT
    responses.user_id,
    questions.topic_id
  FROM public.questions
  INNER JOIN public.user_quiz_responses AS responses
    ON responses.question_id = questions.id
  WHERE questions.is_active
  GROUP BY responses.user_id, questions.topic_id
  HAVING BOOL_AND(responses.is_correct)
    AND COUNT(*) = (
      SELECT COUNT(*)
      FROM public.questions AS active_questions
      WHERE active_questions.topic_id = questions.topic_id
        AND active_questions.is_active
    )
)
INSERT INTO public.user_topic_progress (user_id, topic_id, status, last_studied_at)
SELECT user_id, topic_id, 'completed', NOW()
FROM active_topic_completions
ON CONFLICT (user_id, topic_id) DO UPDATE
SET status = 'completed', last_studied_at = EXCLUDED.last_studied_at
WHERE user_topic_progress.status <> 'completed';

-- Repair medals for learners whose active-only completion was restored above.
INSERT INTO public.user_medals (user_id, medal_slug)
SELECT DISTINCT user_id, 'first-topic'
FROM public.user_topic_progress
WHERE status = 'completed'
ON CONFLICT (user_id, medal_slug) DO NOTHING;

INSERT INTO public.user_medals (user_id, medal_slug)
SELECT DISTINCT progress.user_id, 'all-topics'
FROM public.user_topic_progress AS progress
WHERE progress.status = 'completed'
  AND EXISTS (
    SELECT 1
    FROM public.topics AS topics
    WHERE EXISTS (
      SELECT 1
      FROM public.questions
      WHERE topic_id = topics.id
        AND is_active
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.topics AS topics
    WHERE EXISTS (
      SELECT 1
      FROM public.questions
      WHERE topic_id = topics.id
        AND is_active
    )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_topic_progress AS completed_progress
        WHERE completed_progress.user_id = progress.user_id
          AND completed_progress.topic_id = topics.id
          AND completed_progress.status = 'completed'
      )
  )
ON CONFLICT (user_id, medal_slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.submit_quiz_answer_internal(
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
  v_claimed BOOLEAN := FALSE;
  v_row_count INT := 0;
  v_existing_question_id UUID;
  v_existing_selected_option CHAR(1);
  v_existing_topic_id UUID;
  v_existing_session_id UUID;
  v_existing_result JSONB;
  v_correct_option CHAR(1);
  v_explanation_he TEXT;
  v_question_topic_id UUID;
  v_topic_id UUID;
  v_is_correct BOOLEAN;
  v_newly_correct BOOLEAN := FALSE;
  v_reward_awarded BOOLEAN := FALSE;
  v_old_streak INT := 0;
  v_new_streak INT := 0;
  v_star_points INT := 0;
  v_last_active_date DATE;
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::DATE;
  v_yesterday DATE := ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::DATE - 1);
  v_medal_slug TEXT;
  v_medals_earned JSONB := '[]'::JSONB;
  v_previous_topic_status TEXT;
  v_topic_question_count INT := 0;
  v_correct_response_count INT := 0;
  v_topic_completed BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_idempotency_key IS NULL
     OR char_length(p_idempotency_key) NOT BETWEEN 1 AND 200
     OR p_question_id IS NULL
     OR p_selected_option IS NULL
     OR p_selected_option NOT IN ('a', 'b', 'c', 'd') THEN
    RAISE EXCEPTION 'invalid_quiz_submission';
  END IF;

  SELECT correct_option, explanation_he, topic_id
  INTO v_correct_option, v_explanation_he, v_question_topic_id
  FROM public.questions
  WHERE id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question_not_found';
  END IF;

  IF p_topic_id IS NOT NULL
     AND p_topic_id IS DISTINCT FROM v_question_topic_id THEN
    RAISE EXCEPTION 'topic_question_mismatch';
  END IF;

  v_topic_id := CASE
    WHEN p_topic_id IS NULL THEN NULL
    ELSE v_question_topic_id
  END;

  INSERT INTO public.quiz_answer_submissions (
    user_id,
    idempotency_key,
    question_id,
    selected_option,
    topic_id,
    session_id
  ) VALUES (
    v_user_id,
    p_idempotency_key,
    p_question_id,
    p_selected_option,
    v_topic_id,
    p_session_id
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_claimed := v_row_count = 1;

  IF NOT v_claimed THEN
    SELECT
      question_id,
      selected_option,
      topic_id,
      session_id,
      result
    INTO
      v_existing_question_id,
      v_existing_selected_option,
      v_existing_topic_id,
      v_existing_session_id,
      v_existing_result
    FROM public.quiz_answer_submissions
    WHERE user_id = v_user_id
      AND idempotency_key = p_idempotency_key;

    IF v_existing_question_id IS DISTINCT FROM p_question_id
       OR v_existing_selected_option IS DISTINCT FROM p_selected_option
       OR v_existing_topic_id IS DISTINCT FROM v_topic_id
       OR v_existing_session_id IS DISTINCT FROM p_session_id THEN
      RAISE EXCEPTION 'idempotency_key_conflict';
    END IF;

    IF v_existing_result IS NULL THEN
      RAISE EXCEPTION 'idempotency_result_missing';
    END IF;

    RETURN v_existing_result;
  END IF;

  INSERT INTO public.quiz_submission_rate_limits (
    user_id,
    count,
    window_start
  ) VALUES (
    v_user_id,
    1,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    count = CASE
      WHEN NOW() > quiz_submission_rate_limits.window_start + INTERVAL '60 seconds'
        THEN 1
      ELSE quiz_submission_rate_limits.count + 1
    END,
    window_start = CASE
      WHEN NOW() > quiz_submission_rate_limits.window_start + INTERVAL '60 seconds'
        THEN NOW()
      ELSE quiz_submission_rate_limits.window_start
    END
  WHERE (
    NOW() > quiz_submission_rate_limits.window_start + INTERVAL '60 seconds'
    OR quiz_submission_rate_limits.count < 20
  );

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  v_is_correct := v_correct_option = p_selected_option;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_user_id::TEXT || ':question:' || p_question_id::TEXT, 0)
  );

  IF v_topic_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_user_id::TEXT || ':topic:' || v_topic_id::TEXT, 0)
    );
  END IF;

  PERFORM 1
  FROM public.user_quiz_responses
  WHERE user_id = v_user_id
    AND question_id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_quiz_responses (
      user_id,
      question_id,
      selected_option,
      is_correct,
      answered_at,
      session_id
    ) VALUES (
      v_user_id,
      p_question_id,
      p_selected_option,
      v_is_correct,
      NOW(),
      p_session_id
    );
    v_newly_correct := v_is_correct;
  ELSIF v_is_correct THEN
    UPDATE public.user_quiz_responses
    SET
      selected_option = p_selected_option,
      is_correct = TRUE,
      answered_at = NOW(),
      session_id = p_session_id
    WHERE user_id = v_user_id
      AND question_id = p_question_id
      AND is_correct = FALSE
    RETURNING TRUE INTO v_newly_correct;

    IF NOT FOUND THEN
      UPDATE public.user_quiz_responses
      SET
        selected_option = p_selected_option,
        answered_at = NOW(),
        session_id = p_session_id
      WHERE user_id = v_user_id
        AND question_id = p_question_id;
    END IF;
  ELSE
    UPDATE public.user_quiz_responses
    SET
      selected_option = p_selected_option,
      is_correct = FALSE,
      answered_at = NOW(),
      session_id = p_session_id
    WHERE user_id = v_user_id
      AND question_id = p_question_id;
  END IF;

  IF v_is_correct THEN
    INSERT INTO public.quiz_question_rewards (user_id, question_id)
    VALUES (v_user_id, p_question_id)
    ON CONFLICT (user_id, question_id) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_reward_awarded := v_row_count = 1;
  END IF;

  IF v_reward_awarded THEN
    INSERT INTO public.user_stats (
      user_id,
      star_points,
      streak_days,
      last_active_date
    ) VALUES (
      v_user_id,
      0,
      0,
      NULL
    )
    ON CONFLICT (user_id) DO NOTHING;

    SELECT
      COALESCE(star_points, 0),
      COALESCE(streak_days, 0),
      last_active_date
    INTO
      v_star_points,
      v_old_streak,
      v_last_active_date
    FROM public.user_stats
    WHERE user_id = v_user_id
    FOR UPDATE;

    v_new_streak := CASE
      WHEN v_last_active_date = v_today THEN v_old_streak
      WHEN v_last_active_date = v_yesterday THEN v_old_streak + 1
      ELSE 1
    END;
    v_star_points := v_star_points + 10;

    UPDATE public.user_stats
    SET
      star_points = v_star_points,
      streak_days = v_new_streak,
      last_active_date = v_today
    WHERE user_id = v_user_id;

    IF v_new_streak <> v_old_streak
       AND v_new_streak = ANY (ARRAY[3, 7, 30]) THEN
      v_medal_slug := 'streak-' || v_new_streak::TEXT;

      INSERT INTO public.user_medals (user_id, medal_slug)
      VALUES (v_user_id, v_medal_slug)
      ON CONFLICT (user_id, medal_slug) DO NOTHING
      RETURNING medal_slug INTO v_medal_slug;

      IF v_medal_slug IS NOT NULL THEN
        v_medals_earned := jsonb_build_array(v_medal_slug);
      END IF;
    END IF;
  ELSE
    SELECT
      COALESCE(star_points, 0),
      COALESCE(streak_days, 0)
    INTO
      v_star_points,
      v_new_streak
    FROM public.user_stats
    WHERE user_id = v_user_id;

    v_star_points := COALESCE(v_star_points, 0);
    v_new_streak := COALESCE(v_new_streak, 0);
  END IF;

  IF v_topic_id IS NOT NULL AND v_is_correct THEN
    SELECT status
    INTO v_previous_topic_status
    FROM public.user_topic_progress
    WHERE user_id = v_user_id
      AND topic_id = v_topic_id
    FOR UPDATE;

    INSERT INTO public.user_topic_progress (
      user_id,
      topic_id,
      status,
      last_studied_at
    ) VALUES (
      v_user_id,
      v_topic_id,
      'in_progress',
      NOW()
    )
    ON CONFLICT (user_id, topic_id) DO UPDATE
    SET
      status = CASE
        WHEN user_topic_progress.status = 'completed' THEN 'completed'
        ELSE 'in_progress'
      END,
      last_studied_at = CASE
        WHEN user_topic_progress.status = 'completed'
          THEN user_topic_progress.last_studied_at
        ELSE NOW()
      END;

    SELECT COUNT(*)
    INTO v_topic_question_count
    FROM public.questions
    WHERE topic_id = v_topic_id
      AND is_active;

    SELECT COUNT(DISTINCT responses.question_id)
    INTO v_correct_response_count
    FROM public.user_quiz_responses AS responses
    INNER JOIN public.questions
      ON questions.id = responses.question_id
    WHERE responses.user_id = v_user_id
      AND responses.is_correct = TRUE
      AND questions.topic_id = v_topic_id
      AND questions.is_active;

    IF v_previous_topic_status IS DISTINCT FROM 'completed'
       AND v_topic_question_count > 0
       AND v_correct_response_count = v_topic_question_count THEN
      UPDATE public.user_topic_progress
      SET
        status = 'completed',
        last_studied_at = NOW()
      WHERE user_id = v_user_id
        AND topic_id = v_topic_id
        AND status <> 'completed';

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_topic_completed := v_row_count = 1;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_option', v_correct_option,
    'explanation_he', v_explanation_he,
    'stars_earned', CASE WHEN v_reward_awarded THEN 10 ELSE 0 END,
    'new_total_stars', v_star_points,
    'streak_days', v_new_streak,
    'medals_earned', v_medals_earned,
    'topic_completed', v_topic_completed
  );

  UPDATE public.quiz_answer_submissions
  SET result = v_result
  WHERE user_id = v_user_id
    AND idempotency_key = p_idempotency_key;

  RETURN v_result;
END;
$$;

-- Topic achievement crossings remain serialized per learner. The retired
-- 100-question threshold is deliberately absent, so it cannot be persisted


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
     AND typeof(v_result -> 'is_correct') = 'boolean' THEN
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
VALUES (39, '039_active_content_completion_and_idempotent_srs.sql', '4b13822c60c3d7859acf447b3a9f29e89665feeab59cb07dbf2be54d800d4d46');

COMMIT;
