BEGIN;

-- Reapply the audited prompt-sign mapping for deployments that predate migration 016.
UPDATE questions
SET image_url = CASE question_number
  WHEN 360 THEN '/signs/sign-118.png'
  WHEN 362 THEN '/signs/sign-144.png'
  WHEN 369 THEN '/signs/sign-303.png'
  WHEN 370 THEN '/signs/sign-126.png'
  WHEN 373 THEN '/signs/sign-618.png'
  WHEN 375 THEN '/signs/sign-135.png'
  WHEN 377 THEN '/signs/sign-302.png'
  WHEN 383 THEN '/signs/sign-216.png'
  WHEN 390 THEN '/signs/sign-308.png'
  WHEN 391 THEN '/signs/sign-305.png'
  WHEN 405 THEN '/signs/sign-705.png'
  WHEN 406 THEN '/signs/sign-701.png'
  WHEN 462 THEN '/signs/sign-139.png'
  WHEN 470 THEN '/signs/sign-135.png'
  WHEN 522 THEN '/signs/sign-424.png'
  WHEN 1570 THEN '/signs/sign-135.png'
  ELSE image_url
END
WHERE question_number IN (
  360, 362, 369, 370, 373, 375, 377, 383,
  390, 391, 405, 406, 462, 470, 522, 1570
)
AND topic_id = (SELECT id FROM topics WHERE slug = 'signs');

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (35, '035_repair_prompt_sign_images.sql', 'd89ff258a7056a2452057323edcd712b0decba94645963f98bdc03c842d37e47');

COMMIT;
