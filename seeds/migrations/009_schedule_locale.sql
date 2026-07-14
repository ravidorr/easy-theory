-- Per-user locale on user_schedule so cron notifications (push + email)
-- go out in the user's language. Captured from the NEXT_LOCALE cookie
-- when the schedule is saved; existing rows default to 'he' (the current
-- Hebrew-only behavior).
-- Run this once in the Supabase SQL editor before deploying.

ALTER TABLE user_schedule
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'he'
  CHECK (locale IN ('he', 'ar'));

-- CREATE OR REPLACE with a different argument list would create an overload
-- (and PostgREST rejects ambiguous overloaded RPCs) — drop the old signature.
DROP FUNCTION IF EXISTS replace_user_schedule(INT[], TIME, INT, BOOLEAN);

CREATE FUNCTION replace_user_schedule(
  p_days INT[],
  p_start_time TIME,
  p_duration_minutes INT DEFAULT 45,
  p_notify BOOLEAN DEFAULT TRUE,
  p_locale TEXT DEFAULT 'he'
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
     OR EXISTS (SELECT 1 FROM unnest(p_days) AS d WHERE d IS NULL OR d < 0 OR d > 6)
     OR p_locale IS NULL OR p_locale NOT IN ('he', 'ar') THEN
    RAISE EXCEPTION 'invalid_schedule_input';
  END IF;

  DELETE FROM user_schedule WHERE user_id = v_user_id;

  -- DISTINCT dedupes days: user_schedule has no UNIQUE(user_id, day_of_week)
  INSERT INTO user_schedule (user_id, day_of_week, start_time, duration_minutes, notify, locale)
  SELECT DISTINCT v_user_id, d, p_start_time,
         COALESCE(p_duration_minutes, 45), COALESCE(p_notify, TRUE), p_locale
  FROM unnest(p_days) AS d;
END;
$$;
