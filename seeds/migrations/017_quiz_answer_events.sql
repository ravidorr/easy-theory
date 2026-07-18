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

-- Quiz responses are mutated only by the rate-limited SECURITY DEFINER RPC.
-- Otherwise clients could create answer events without an accepted submission.
DROP POLICY IF EXISTS "own insert" ON public.user_quiz_responses;
DROP POLICY IF EXISTS "own update" ON public.user_quiz_responses;

-- The trigger runs in submit_quiz_answer's transaction, so it records only
-- accepted, non-replayed submissions without duplicating the RPC body.
CREATE OR REPLACE FUNCTION public.record_quiz_answer_event()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- The idempotency ledger retains successful submissions for 24 hours. Seed
-- the current Jerusalem day so deploying mid-day preserves goal progress.
-- Older projects that predate that ledger retain only the latest response,
-- which is still enough to preserve their distinct-question progress.
DO $$
BEGIN
  IF to_regclass('public.quiz_answer_submissions') IS NOT NULL THEN
    EXECUTE $backfill$
      INSERT INTO public.quiz_answer_events (
        user_id,
        question_id,
        is_correct,
        answered_at
      )
      SELECT
        submissions.user_id,
        submissions.question_id,
        (submissions.result ->> 'is_correct')::BOOLEAN,
        submissions.created_at
      FROM public.quiz_answer_submissions AS submissions
      WHERE submissions.result IS NOT NULL
        AND submissions.created_at >= (
          date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')
            AT TIME ZONE 'Asia/Jerusalem'
        )
        AND submissions.created_at < (
          (
            date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')
              + INTERVAL '1 day'
          ) AT TIME ZONE 'Asia/Jerusalem'
        )
    $backfill$;
  ELSE
    INSERT INTO public.quiz_answer_events (
      user_id,
      question_id,
      is_correct,
      answered_at
    )
    SELECT
      responses.user_id,
      responses.question_id,
      responses.is_correct,
      responses.answered_at
    FROM public.user_quiz_responses AS responses
    WHERE responses.answered_at >= (
      date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')
        AT TIME ZONE 'Asia/Jerusalem'
    )
      AND responses.answered_at < (
        (
          date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')
            + INTERVAL '1 day'
        ) AT TIME ZONE 'Asia/Jerusalem'
      );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_quiz_answer_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_quiz_answer_event() FROM anon, authenticated;
