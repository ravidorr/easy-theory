# Data backups

The Supabase project is on the Free plan, which has no backups. A scheduled GitHub Actions
workflow therefore copies every table that holds personal data or user choices into a
private repository once a day.

## Where the backups live

- Repository: `ravidorr/easy-theory-backups`. It is private, hosted by GitHub in the United
  States, and only the maintainer has access.
- Format: one JSON file per table, keys sorted, rows sorted by primary key, plus
  `manifest.json` with row counts. Stable output keeps the daily diffs small.
- Commit messages contain counts only, for example `Backup: 1551 rows in 17 tables`.
- Nothing is written to this repository, to Actions logs, or to artifacts. The export runs in
  a temporary directory outside the checkout and the logs show counts only.

## What is backed up

Supabase auth users (id, email, phone, sign-in providers, metadata, timestamps) plus the
tables listed in `scripts/backup/tables.ts`, in foreign-key order: `user_stats`,
`user_medals`, `user_schedule`, `user_learner_plans`, `user_topic_progress`,
`user_quiz_responses`, `quiz_answer_events`, `quiz_question_rewards`, `user_exam_attempts`,
`user_exam_sessions`, `user_diagnostic_attempts`, `user_question_bookmarks`,
`user_srs_cards`, `user_push_subscriptions`, `contact_messages` and `question_reports`.

Left out on purpose:

- Public or rebuildable content: `topics`, `questions`, `signs`, `videos`, `resources`,
  `content_source_releases` and `schema_migrations`. They come back from `seeds/`.
- Short-lived dedupe and abuse-control state: `quiz_answer_submissions` (24 hour replay
  cache), `quiz_submission_rate_limits` and `schedule_notification_deliveries`.

When a migration adds a table with personal data or user choices, add it to
`scripts/backup/tables.ts` in the same pull request.

## How the daily run works

`.github/workflows/daily-backup.yml` runs at 03:17 UTC and on manual dispatch, in the
`database-backup` environment.

1. `scripts/backup-export.ts` reads every table completely, with the service-role key,
   in pages of 1000. It fails if any table cannot be read, or if a table changes while it is
   being read and stays inconsistent after three attempts. Nothing is written to disk until
   every table has been read.
2. The workflow clones the backup repository over SSH with a write deploy key, written to a
   temporary file only inside that step and used with `IdentitiesOnly=yes` and a pinned
   GitHub host key. The key is removed when the step ends, including on failure.
3. `scripts/backup-publish.ts` copies the files in and commits only if something changed.
4. The workflow pushes. The service-role key and the deploy key are exposed to this one step
   only.
5. If the job fails, a second job opens (or comments on) an issue titled "Daily data backup
   failed" with a link to the run. It contains no data.

GitHub disables scheduled workflows after 60 days without repository activity. Regular
merges to this repository keep it running; check the Actions tab if that ever stops.

## Retention

The backup repository keeps history, so an account deleted in the app would remain in old
commits. When the oldest commit is older than 30 days, `backup-publish.ts` replaces the
whole history with one orphan commit of the current files, and the workflow force-pushes it.
Deleted accounts therefore leave every reachable commit within 30 days (up to 30 days of
retention). GitHub may keep unreachable objects on its servers until its own garbage
collection, which this process does not control. This applies only to the backup
repository, never to this one.

## Restore

```bash
git clone git@github.com:ravidorr/easy-theory-backups.git /tmp/easy-theory-backup
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm backup:restore /tmp/easy-theory-backup
```

The restore reads and validates every file against the manifest before it writes anything.
It is additive and idempotent: it never deletes, creates missing auth users with their
original ids, and upserts the tables in foreign-key order. Rows that already match are
skipped, because rewriting them would fire database triggers such as the quiz answer log a
second time. For `quiz_answer_events`, which has no primary key, only missing rows are
inserted.

To restore into a bare PostgreSQL database (for example to inspect a backup), set
`RESTORE_DATABASE_URL` instead of the Supabase variables. The target needs the schema from
`seeds/` and an `auth.users` table.

Known limits:

- Through the Supabase API an auth user is recreated with its id, email, phone, metadata and
  confirmation state. Sign-in is by email code, so no password is lost, but `created_at` and
  `last_sign_in_at` are not restored on that path.
- Restoring over a project whose rows have since changed rewrites those rows with the backup
  values, and a changed quiz response adds one answer event through its trigger.

## Restore rehearsal

The rehearsal applies `seeds/schema.sql` and the migrations to a throwaway local PostgreSQL,
inserts fixture rows in every backed-up table, exports, empties the tables, restores,
exports again and compares the files byte for byte. It then restores a second time and
checks that nothing changed. It refuses to run against anything but a local database.

```bash
docker run -d --name et-rehearsal -e POSTGRES_PASSWORD=rehearsal -p 127.0.0.1:55439:5432 postgres:17-alpine
REHEARSAL_DATABASE_URL=postgresql://postgres:rehearsal@127.0.0.1:55439/postgres pnpm backup:rehearse
docker rm -f et-rehearsal
```

Stand-ins for Supabase (`auth.users`, `auth.uid()`, the roles and `cron.schedule`) live in
`scripts/backup/rehearsal-bootstrap.sql`. Four migrations are skipped because
`seeds/schema.sql` already contains their objects.

Last rehearsal: 2026-11-15. Result: 21 fixture rows in 17 files restored identically, and a
second restore changed nothing. The rehearsal found one real problem that is now fixed: a
repeated restore fired the quiz answer trigger and duplicated answer events.

The Supabase API path of the restore (`auth.admin.createUser` and table upserts) cannot run
against a local database. On 2026-11-15 a live read-only check confirmed that restoring a
fresh export onto the live project would write nothing, which proves the read and compare
path against the real API. The write path itself has not been run against a Supabase
project; run a restore into a scratch Supabase project before relying on it.

## Yearly access review

Add these to the yearly access review:

- GitHub repository `ravidorr/easy-theory-backups` (collaborators, and the one deploy key
  titled "easy-theory daily backup").
- The `database-backup` environment secrets: `BACKUP_DEPLOY_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`.

Rotate the deploy key by generating a new ed25519 pair, replacing the deploy key and the
secret, and removing the old key.
