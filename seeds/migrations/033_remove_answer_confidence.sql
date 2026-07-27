BEGIN;

DROP TABLE public.user_answer_confidence;

-- migration-ledger: checksum normalized by scripts/audit-database-metadata.ts.
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (33, '033_remove_answer_confidence.sql', 'a42269472c5912f6402efa954ba5b619361303c1d8428a8023d5aae5c7d9337a');

COMMIT;
