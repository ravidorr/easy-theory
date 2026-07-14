-- Atomically persists a quiz answer and its gamification result.
-- Deploy this migration before the application version that calls submit_quiz_answer.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE public.quiz_answer_submissions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 200
  ),
  question_id UUID NOT NULL REFERENCES public.questions(id),
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  topic_id UUID REFERENCES public.topics(id),
  session_id UUID,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, idempotency_key)
);

-- Retain replay results for 24 hours. At the fixed 20/minute database limit,
-- this bounds an active user's retained rows while covering realistic reloads.
CREATE INDEX quiz_answer_submissions_created_at_idx
  ON public.quiz_answer_submissions (created_at);

ALTER TABLE public.quiz_answer_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_answer_submissions FROM PUBLIC;
REVOKE ALL ON TABLE public.quiz_answer_submissions FROM anon, authenticated;

CREATE TABLE public.quiz_submission_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quiz_submission_rate_limits_window_start_idx
  ON public.quiz_submission_rate_limits (window_start);

ALTER TABLE public.quiz_submission_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_submission_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.quiz_submission_rate_limits FROM anon, authenticated;

-- Reward eligibility is immutable even though the latest response remains mutable
-- for review and retry behavior. The primary key is the concurrency boundary.
CREATE TABLE public.quiz_question_rewards (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- Best-effort backfill: currently correct responses are treated as already
-- rewarded. Historical correct-then-wrong transitions are not recoverable from
-- the mutable response table, so a rare first correct answer after deployment
-- can award 10 points once more. This accepted limitation avoids fail-closing
-- every existing wrong response and does not affect rewards after this ledger
-- exists.
INSERT INTO public.quiz_question_rewards (user_id, question_id)
SELECT user_id, question_id
FROM public.user_quiz_responses
WHERE is_correct = TRUE
ON CONFLICT (user_id, question_id) DO NOTHING;

ALTER TABLE public.quiz_question_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_question_rewards FROM PUBLIC;
REVOKE ALL ON TABLE public.quiz_question_rewards FROM anon, authenticated;

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
    -- Raising rolls back the new idempotency claim with the whole transaction.
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
       AND v_new_streak = ANY (ARRAY[3, 7, 14, 30]) THEN
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
    WHERE topic_id = v_topic_id;

    SELECT COUNT(DISTINCT responses.question_id)
    INTO v_correct_response_count
    FROM public.user_quiz_responses AS responses
    INNER JOIN public.questions
      ON questions.id = responses.question_id
    WHERE responses.user_id = v_user_id
      AND responses.is_correct = TRUE
      AND questions.topic_id = v_topic_id;

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

REVOKE ALL ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(TEXT, UUID, TEXT, UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_quiz_submission_state(
  p_batch_size INTEGER DEFAULT 1000,
  p_max_rows INTEGER DEFAULT 10000
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_total INTEGER := 0;
  v_batch_deleted INTEGER := 0;
BEGIN
  IF p_batch_size < 1 OR p_batch_size > 10000 THEN
    RAISE EXCEPTION 'invalid_cleanup_batch_size';
  END IF;

  IF p_max_rows < 2 OR p_max_rows > 50000 THEN
    RAISE EXCEPTION 'invalid_cleanup_max_rows';
  END IF;

  -- Rate-limit rows are small and immediately disposable. Remove only the
  -- expired rows that exist, then give submissions the shared remaining budget.
  WHILE v_deleted_total < p_max_rows LOOP
    WITH expired_rate_limits AS (
      SELECT user_id
      FROM public.quiz_submission_rate_limits
      WHERE window_start < NOW() - INTERVAL '5 minutes'
      ORDER BY window_start
      LIMIT LEAST(
        p_batch_size,
        p_max_rows - v_deleted_total
      )
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.quiz_submission_rate_limits AS rate_limits
    USING expired_rate_limits
    WHERE rate_limits.user_id = expired_rate_limits.user_id;

    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
    v_deleted_total := v_deleted_total + v_batch_deleted;
    EXIT WHEN v_batch_deleted = 0;
  END LOOP;

  WHILE v_deleted_total < p_max_rows LOOP
    WITH expired_submissions AS (
      SELECT user_id, idempotency_key
      FROM public.quiz_answer_submissions
      WHERE created_at < NOW() - INTERVAL '24 hours'
      ORDER BY created_at
      LIMIT LEAST(
        p_batch_size,
        p_max_rows - v_deleted_total
      )
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.quiz_answer_submissions AS submissions
    USING expired_submissions
    WHERE submissions.user_id = expired_submissions.user_id
      AND submissions.idempotency_key = expired_submissions.idempotency_key;

    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
    v_deleted_total := v_deleted_total + v_batch_deleted;
    EXIT WHEN v_batch_deleted = 0;
  END LOOP;

  RETURN v_deleted_total;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_quiz_submission_state(INTEGER, INTEGER)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_quiz_submission_state(INTEGER, INTEGER)
  FROM anon, authenticated;

SELECT cron.schedule(
  'cleanup-quiz-submission-state',
  '* * * * *',
  $$SELECT public.cleanup_quiz_submission_state(1000, 10000);$$
);
