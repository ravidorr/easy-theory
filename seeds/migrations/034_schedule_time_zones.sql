BEGIN;

ALTER TABLE public.user_schedule
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'Asia/Jerusalem';

-- Avoid an overloaded RPC signature: PostgREST rejects ambiguous overloads.
DROP FUNCTION IF EXISTS replace_user_schedule(INT[], TIME, INT, BOOLEAN, TEXT);

CREATE FUNCTION replace_user_schedule(
  p_days INT[],
  p_start_time TIME,
  p_duration_minutes INT DEFAULT 45,
  p_notify BOOLEAN DEFAULT TRUE,
  p_locale TEXT DEFAULT 'he',
  p_time_zone TEXT DEFAULT 'Asia/Jerusalem'
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
     OR p_locale IS NULL OR p_locale NOT IN ('he', 'ar')
     OR p_time_zone IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'invalid_schedule_input';
  END IF;

  DELETE FROM user_schedule WHERE user_id = v_user_id;

  INSERT INTO user_schedule (
    user_id, day_of_week, start_time, duration_minutes, notify, locale, time_zone
  )
  SELECT DISTINCT v_user_id, d, p_start_time,
         COALESCE(p_duration_minutes, 45), COALESCE(p_notify, TRUE), p_locale, p_time_zone
  FROM unnest(p_days) AS d;
END;
$$;

CREATE TABLE IF NOT EXISTS public.schedule_notification_deliveries (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, local_date)
);

ALTER TABLE public.schedule_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.schedule_notification_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE public.schedule_notification_deliveries FROM anon, authenticated;

-- Pending claims are a lease. Explicit send failures remove the claim; an
-- interrupted invocation can be retried after the lease expires.
CREATE FUNCTION public.claim_schedule_notification(
  p_user_id UUID,
  p_local_date DATE
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_claimed BOOLEAN;
BEGIN
  INSERT INTO public.schedule_notification_deliveries (
    user_id, local_date, status, claimed_at
  ) VALUES (
    p_user_id, p_local_date, 'pending', NOW()
  )
  ON CONFLICT (user_id, local_date) DO UPDATE
  SET status = 'pending', claimed_at = NOW(), sent_at = NULL
  WHERE schedule_notification_deliveries.status = 'pending'
    AND schedule_notification_deliveries.claimed_at < NOW() - INTERVAL '15 minutes'
  RETURNING TRUE INTO v_claimed;

  RETURN COALESCE(v_claimed, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_schedule_notification(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_schedule_notification(UUID, DATE) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_schedule_notification(UUID, DATE) TO service_role;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (34, '034_schedule_time_zones.sql', 'c6608e52c97f32db4cbd8adb5e70bab916e3dc2a20b5e68224cda03e9fd3b282');

COMMIT;
