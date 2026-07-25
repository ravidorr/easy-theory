BEGIN;

DO $$
DECLARE
  stored_025 TEXT;
  stored_026 TEXT;
  legacy_025 CONSTANT TEXT := 'dc6523b1a67de32083fe6c2a163094143891c08d066bde27856a40bbc05298a1';
  expected_025 CONSTANT TEXT := '5578a47115319b1dddb1bd4ae612afa96a9451e9cf19da30e53be55be79a51b3';
  expected_026 CONSTANT TEXT := '40ee41fadc0790773a757e42962446b677845ef321598bd5030c7530efb2ea7d';
BEGIN
  SELECT checksum
  INTO stored_025
  FROM public.schema_migrations
  WHERE version = 25
    AND filename = '025_contact_messages.sql'
  FOR UPDATE;

  IF stored_025 IS NULL THEN
    RAISE EXCEPTION 'Migration 025 ledger row is missing or has an unexpected filename';
  END IF;

  IF stored_025 NOT IN (legacy_025, expected_025) THEN
    RAISE EXCEPTION 'Migration 025 has unexpected checksum: %', stored_025;
  END IF;

  SELECT checksum
  INTO stored_026
  FROM public.schema_migrations
  WHERE version = 26
    AND filename = '026_question_reports.sql'
  FOR UPDATE;

  IF stored_026 IS DISTINCT FROM expected_026 THEN
    RAISE EXCEPTION 'Migration 026 must be applied before this reconciliation; found: %', stored_026;
  END IF;

  UPDATE public.schema_migrations
  SET checksum = expected_025
  WHERE version = 25
    AND checksum = legacy_025;
END;
$$;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (27, '027_reconcile_migration_ledger.sql', '2b174ecf1c7469e70f0e6de5ba3ba82680b6c040921a10b46a6677615a627231');

COMMIT;
