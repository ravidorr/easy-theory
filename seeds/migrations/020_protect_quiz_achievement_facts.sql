-- Quiz facts and their progress projection are authored by submit_quiz_answer.
-- Authenticated clients may read their history but cannot forge achievements.

DROP POLICY IF EXISTS "own insert" ON public.user_quiz_responses;
DROP POLICY IF EXISTS "own update" ON public.user_quiz_responses;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_quiz_responses FROM authenticated;

DROP POLICY IF EXISTS "own insert" ON public.user_topic_progress;
DROP POLICY IF EXISTS "own update" ON public.user_topic_progress;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_topic_progress FROM authenticated;
