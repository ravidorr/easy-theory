-- Achievement ownership is authoritative. Client sessions may read their
-- medals, but only verified server-side gamification paths may create them.

DROP POLICY IF EXISTS "own insert" ON public.user_medals;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_medals FROM authenticated;

CREATE FUNCTION public.award_exam_pass_medal()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_medal_slug TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_exam_attempts
    WHERE user_id = v_user_id
      AND passed = TRUE
  ) THEN
    RAISE EXCEPTION 'exam_not_passed';
  END IF;

  INSERT INTO public.user_medals (user_id, medal_slug)
  VALUES (v_user_id, 'exam-pass')
  ON CONFLICT (user_id, medal_slug) DO NOTHING
  RETURNING medal_slug INTO v_medal_slug;

  RETURN v_medal_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.award_exam_pass_medal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_exam_pass_medal() FROM anon;
GRANT EXECUTE ON FUNCTION public.award_exam_pass_medal() TO authenticated;
