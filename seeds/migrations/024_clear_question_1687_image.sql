-- The official source for question 1687 has no image; migration 002 assigned
-- sign 110 by mistake, causing numeric speed answers to be rendered as signs.
BEGIN;

UPDATE public.questions
SET image_url = ''
WHERE question_number = 1687;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (24, '024_clear_question_1687_image.sql', '8457937660653c47b498e25183563dc075b5aa8b9a6d3f608d28b6248fe34bc3');

COMMIT;
