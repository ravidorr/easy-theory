-- Preserve every accepted quiz answer for daily pacing. The mutable
-- user_quiz_responses row remains the source of distinct-question accuracy.

CREATE TABLE public.quiz_answer_events (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quiz_answer_events_user_answered_at_idx
  ON public.quiz_answer_events (user_id, answered_at);

ALTER TABLE public.quiz_answer_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_answer_events FROM PUBLIC;
REVOKE ALL ON TABLE public.quiz_answer_events FROM anon, authenticated;

CREATE POLICY "own select" ON public.quiz_answer_events
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.quiz_answer_events TO authenticated;

-- submit_quiz_answer is a single database transaction. Recording from this
-- trigger means only successful, non-replayed response mutations add an event
-- while avoiding a stale second copy of the RPC body in this migration.
CREATE OR REPLACE FUNCTION public.record_quiz_answer_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.quiz_answer_events (
    user_id,
    question_id,
    is_correct,
    answered_at
  ) VALUES (
    NEW.user_id,
    NEW.question_id,
    NEW.is_correct,
    NEW.answered_at
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_quiz_responses_record_answer_event
AFTER INSERT OR UPDATE OF selected_option, is_correct, answered_at, session_id
ON public.user_quiz_responses
FOR EACH ROW
EXECUTE FUNCTION public.record_quiz_answer_event();

REVOKE ALL ON FUNCTION public.record_quiz_answer_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_quiz_answer_event() FROM anon, authenticated;
