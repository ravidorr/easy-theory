-- Atomic replace of a user's weekly schedule.
-- Replaces the app-level delete-then-insert (which could wipe the schedule
-- if the insert failed) with a single transactional function.
-- Run this once in the Supabase SQL editor before deploying.

CREATE OR REPLACE FUNCTION replace_user_schedule(
  p_days INT[],
  p_start_time TIME,
  p_duration_minutes INT DEFAULT 45,
  p_notify BOOLEAN DEFAULT TRUE
) RETURNS VOID
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_days IS NULL OR p_start_time IS NULL
     OR COALESCE(array_length(p_days, 1), 0) > 7
     OR EXISTS (SELECT 1 FROM unnest(p_days) AS d WHERE d IS NULL OR d < 0 OR d > 6) THEN
    RAISE EXCEPTION 'invalid_schedule_input';
  END IF;

  DELETE FROM user_schedule WHERE user_id = v_user_id;

  -- DISTINCT dedupes days: user_schedule has no UNIQUE(user_id, day_of_week)
  INSERT INTO user_schedule (user_id, day_of_week, start_time, duration_minutes, notify)
  SELECT DISTINCT v_user_id, d, p_start_time,
         COALESCE(p_duration_minutes, 45), COALESCE(p_notify, TRUE)
  FROM unnest(p_days) AS d;
END;
$$;
