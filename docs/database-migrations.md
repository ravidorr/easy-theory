# Database migrations

Production is the only Supabase project. Schema changes live in `seeds/migrations/`
as numbered SQL files (`NNN_description.sql`) and are applied in filename order.

## Migration ledger

Every migration from 024 onward must include its own ledger row. Put the marker and an
initial placeholder checksum after the schema changes (before the closing `COMMIT;` when
the file has one), run the checksum command, then replace the placeholder before
executing the migration:

```sql
-- migration-ledger: the checksum literal is normalized before hashing
INSERT INTO public.schema_migrations (version, filename, checksum)
VALUES (24, '024_example.sql', '<sha256 from db:migration:checksum>');
```

```bash
pnpm db:migration:checksum seeds/migrations/024_example.sql
```

The migration-integrity workflow checks that a new migration contains a line starting with
`-- migration-ledger:`. It does not validate the `INSERT` or the checksum; the release
audit catches those.

## Release gate

`Database Release` runs from trusted `main` (never for pull-request code):

1. Waits for the `database-production` environment approval, then applies only the
   missing committed migrations with `pnpm db:migrate --target production --apply`.
2. Audits the production migration ledger against the committed SQL files
   (`pnpm db:audit`).
3. Requests a Vercel production deploy.

Configure these GitHub environments before relying on the workflow:

- `database-production`: require a reviewer; set `PROD_DATABASE_URL`.
- `database-audit`: set `PROD_DATABASE_URL` (a direct PostgreSQL connection string,
  not the Supabase API URL).

Set `VERCEL_PRODUCTION_DEPLOY_HOOK` as an Actions repository secret (a Vercel
production deploy-hook URL). It is consumed only after the approved production
migration and the required audit pass.

Vercel production must retain `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The `prebuild` lifecycle runs the ledger verifier, which
enforces only when `VERCEL_ENV=production` or `MIGRATION_LEDGER_GATE=1` is set (or
`--require` is passed); otherwise it logs "skipped" and exits 0. When it enforces, it
fails the build if `public.schema_migrations` differs from the committed SQL files.

The six-hour **Database Ledger Audit** workflow is the continuous check; the same audit
is also a required release step. `pnpm db:audit` runs it locally when
`PROD_DATABASE_URL` is set.

## What the audit does not check

`pnpm db:audit` compares only the `public.schema_migrations` ledger with the committed
SQL files. It proves the committed migrations ran unchanged, not that the live schema
still matches them. The earlier production-versus-QA catalog comparison (RLS flags and
policies, triggers, function definitions, grants, indexes and constraints) was removed
with the QA project, and nothing replaces it. A manual change to a policy or grant in the
Supabase dashboard will not fail the release gate, so make schema changes only through
migrations. A single-database catalog audit against a committed baseline snapshot would
close this gap if it is wanted later.
