-- Record the exact migration source applied to this project. This bootstrap
-- establishes the verified 001–022 baseline; future migrations must append
-- their own row in the same transaction after their schema changes.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  filename TEXT NOT NULL UNIQUE CHECK (filename ~ '^[0-9]{3}_.+[.]sql$'),
  checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PostgreSQL regular expressions do not support \d. Recreate this constraint
-- so a partial first run of this migration can be safely re-run.
ALTER TABLE public.schema_migrations
  DROP CONSTRAINT IF EXISTS schema_migrations_filename_check;
ALTER TABLE public.schema_migrations
  ADD CONSTRAINT schema_migrations_filename_check
  CHECK (filename ~ '^[0-9]{3}_.+[.]sql$');

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.schema_migrations FROM PUBLIC;
REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated;

-- migration-ledger: checksums cover each whole file with only the
-- self-referential checksum literal normalized. The audit script validates
-- every row against Git.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES
  (1, '001_quiz_responses_unique.sql', '2809f78ce8b8b43fac1454565ffbdf6f723b4834c569671ca3945bcee81893cd'),
  (2, '002_fix_correct_options.sql', '7e9e90daacead60c4b9b15991f39537321c844d4f75963da1a0f79a637faf874'),
  (3, '003_fix_sign_102_name.sql', '2dd44589466e45e46ba2b16e2b329f76f93b722a768325e7c0d83ae03e56a7e2'),
  (4, '004_quiz_responses_update_policy.sql', 'a793ae2b726dcdfe9184e4b63266cd2b976eb99b63d4990aa1be7db76489075b'),
  (5, '005_arabic_columns.sql', 'ccef528ab92c563da6950dcedceea83d52b645ab857bf8e07e34bb2af1134a13'),
  (6, '006_quiz_responses_session_id.sql', 'd7c77fbdd37f7ccb179f35e0e0bdecbe29a4047a9f060943ded547ebd58dd09e'),
  (7, '007_exam_attempts.sql', '9935fd456548637b431923d5f109b77f084108b2a0f8d4fc277f97e2b65c9c9c'),
  (8, '008_replace_user_schedule.sql', 'ba9c32650bf19a007b1329bfd14cb3433cc7972aeace2222b75712f962ff958d'),
  (9, '009_schedule_locale.sql', '0a9f16a259279ebf3f468dc0719edcb48eddaecac8e0bf104831fdfc724c820a'),
  (10, '010_quiz_submission_idempotency.sql', '1da2778f41dd46c40757965407e74ccfad8f50c9d4009cc1028b4dfc374ba3c7'),
  (11, '011_fix_sign_409_correct_answer.sql', '4d3eccf90c638a6302ca8ad2ed7eba030775fc2f1136e22e8140a7636cdc2cd4'),
  (12, '012_videos_resources.sql', 'd9400b36d9b38025210e344fc8b0b09d311ac2499b4e8a10d3f8bd75b2eb387e'),
  (13, '013_question_bookmarks.sql', '7dd2e708579f7a70ae590fba75c012d7e4b9ccd9aefcac204af44b4bd0847daf'),
  (14, '014_srs_cards.sql', '30aee6af2b35ff3422d3e0247895089721daf810cffec3827696a4ee2c3d44a3'),
  (15, '015_signs_question_15_arabic.sql', '468613643dc697b0f591bb94fbb35f6f4c5f9aa92505c223ada7758bfdf1e7f0'),
  (16, '016_fix_prompt_sign_images.sql', '92467b770eb00966512b031face6ad8f1864d7f495d08a951553be96ec8f3365'),
  (17, '017_quiz_answer_events.sql', '72758d63c4ccb8ea3f5663ecfd3e4137fae2d14bc3722ea78f51943823b7491b'),
  (18, '018_align_user_srs_ease.sql', '491d8a886d5e8d23872ae6e6e080e058a31bd8921dbeb6cf78c8a049745aaf76'),
  (19, '019_questions_achievement_serialization.sql', '5ca07f13cabf22016d9f4139832c2b70c7fb834717818b582141d0d57e11a026'),
  (20, '020_protect_achievement_medals.sql', '65dbaa9482f5ef7e86b097d2f36fcb86da2ba30857f99ff3b23503bdb6fe7cbd'),
  (21, '021_protect_quiz_achievement_facts.sql', '90d94c1ae9ef6290d804654acd0a9060dc8e9dc256664e0ba9b9226d863018d1'),
  (22, '022_correct_signs_104_107_locales.sql', 'ed3cfec54c833de7323907749eef9ad85dc10e0e4d136abb067028ec9e92925f'),
  (23, '023_migration_ledger.sql', 'cbe8e7695a3ba323050edbc1451b36925dc20a573ddaf25d69af6e50253ca710');
