-- Repair projects where user_srs_cards was created from an early draft that
-- used REAL for ease. Clamp the SM-2 floor before recreating its constraint in
-- double precision so existing floor values survive the conversion.

BEGIN;

ALTER TABLE public.user_srs_cards
  DROP CONSTRAINT IF EXISTS user_srs_cards_ease_check;

ALTER TABLE public.user_srs_cards
  ALTER COLUMN ease DROP DEFAULT,
  ALTER COLUMN ease TYPE DOUBLE PRECISION
    USING GREATEST(ease::DOUBLE PRECISION, 1.3::DOUBLE PRECISION),
  ALTER COLUMN ease SET DEFAULT 2.5;

ALTER TABLE public.user_srs_cards
  ADD CONSTRAINT user_srs_cards_ease_check CHECK (ease >= 1.3);

COMMIT;
