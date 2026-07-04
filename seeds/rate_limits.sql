-- Rate limiting table and RPC function.
-- Run this once in the Supabase SQL editor before deploying.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window_seconds INT
) RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO rate_limits (key, count, window_start)
  VALUES (p_key, 1, NOW())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN NOW() > rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL
      THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN NOW() > rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL
      THEN NOW()
      ELSE rate_limits.window_start
    END
  WHERE (
    NOW() > rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL
    OR rate_limits.count < p_limit
  );

  -- FOUND is true when the INSERT/UPDATE actually wrote a row (i.e. not blocked by the WHERE clause)
  RETURN FOUND;
END;
$$;
