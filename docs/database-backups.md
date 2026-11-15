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

Supabase auth users (id, email, phone, metadata, confirmation and sign-in timestamps; the
provider is inside `app_metadata`) plus the tables listed in `scripts/backup/tables.ts`, in
foreign-key order.

- Personal data and user choices: `user_stats`, `user_medals`, `user_schedule`,
  `user_learner_plans`, `user_topic_progress`, `user_quiz_responses`, `quiz_answer_events`,
  `quiz_question_rewards`, `user_exam_attempts`, `user_exam_sessions`,
  `user_diagnostic_attempts`, `user_question_bookmarks`, `user_srs_cards`,
  `user_push_subscriptions`, `contact_messages` and `question_reports`.
- Referenced content, with its original ids: `content_source_releases`, `topics`, `questions`
  and `signs`. The seeds create these with random UUIDs, so a project rebuilt from the seeds
  gets different ids and none of the user rows above would point at the right content. They
  are public and change rarely, so they add little to the daily diffs.

Left out on purpose: `videos` and `resources` (public, nothing references them),
`schema_migrations` (rebuilt by the migration runner), and short-lived state:
`quiz_answer_submissions` (24 hour replay cache), `quiz_submission_rate_limits` and
`schedule_notification_deliveries`. A test fails when a migration adds a table that is in
neither list, so a new table cannot be forgotten silently.

## How the daily run works

`.github/workflows/daily-backup.yml` runs at 03:17 UTC and on manual dispatch, in the
`database-backup` environment.

1. `scripts/backup-export.ts` reads every table completely, with the service-role key,
   in pages of 1000, ordered by key. It fails if any table cannot be read. A read is retried,
   and finally rejected, when the row total changes between pages, a key repeats, or a row
   points at an id that is not in the export (for example a user who signed up between two
   table reads). It also refuses an export with no auth users, so a wrong key cannot publish
   an empty backup. Nothing is written to disk until every table has been read, and the
   manifest is written last.
2. The workflow clones the backup repository over SSH with a write deploy key, written to a
   temporary file only inside that step and used with `IdentitiesOnly=yes` and a pinned
   GitHub host key. The key is removed when the step ends, including on failure.
3. `scripts/backup-publish.ts` checks that every expected file exists and matches the
   manifest, copies the files in and commits only if something changed.
4. The workflow pushes. The service-role key and the deploy key are exposed to this one step
   only.
5. If the job fails or is cancelled, a second job opens (or comments on) an issue titled
   "Daily data backup failed" with a link to the run. It contains no data.

A run that never starts raises no alert. GitHub disables scheduled workflows after 60 days
without repository activity, and may delay or drop a scheduled run. Regular merges to this
repository keep it running; check the Actions tab if the backup repository stops getting
commits for an unusually long time. Days with no data change leave no commit, so a quiet
repository alone is not a sign of failure.

## Retention

The backup repository keeps history, so an account deleted in the app would remain in old
commits. On the first run after the oldest commit is older than 29 days, `backup-publish.ts`
replaces the whole history with one orphan commit of the current files, and the workflow
force-pushes it. With daily runs that is the day-30 run, so history is replaced about every
30 days and a deleted account leaves every reachable commit within about 30 days, provided
the daily run keeps succeeding (a missed run delays the reset). GitHub may keep unreachable
objects on its servers until its own garbage collection, which this process does not
control. This applies only to the backup repository, never to this one.

## Restore

```bash
git clone git@github.com:ravidorr/easy-theory-backups.git /tmp/easy-theory-backup
```

Preferred, full fidelity: a direct PostgreSQL connection to the target database.

```bash
RESTORE_DATABASE_URL=postgresql://... pnpm backup:restore /tmp/easy-theory-backup
```

This path disables the table's user triggers while it writes, so the backup comes back
exactly as stored: the quiz answer log is not written a second time, responses to retired
questions are accepted, and auth user timestamps are kept. The target needs the schema from
`seeds/schema.sql` and the migrations. For a replacement project do not load the content
seeds: the backup carries the content with its original ids, and seeded content would clash
with it on slug and question number.

Through the Supabase API (`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`) the same
restore runs, with these limits, because the triggers stay active:

- A response to a retired question is rejected by the database (`P0001`) and stops the
  restore. Use the direct connection instead.
- Responses that were answered before the answer log existed get one extra log event.
- Auth users are recreated with their id, email, phone, metadata and confirmation state, but
  not `created_at` or `last_sign_in_at`. Sign-in is by email code, so no password is lost.

In both modes the restore checks every file's row count against the manifest before it writes
anything. It is additive and idempotent: it never deletes, creates missing auth users, and
upserts the tables in foreign-key order. Rows that already match are skipped. For
`quiz_answer_events`, which has no primary key, only missing rows are inserted. A failure
part way leaves earlier tables written; rerunning is safe.

Restoring over a project whose rows have since changed rewrites those rows with the backup
values. If a user row was recreated under a new id, the restore stops on that table's
secondary unique constraint (for example one medal per user), which is loud rather than
silent.

## Restore rehearsal

The rehearsal applies `seeds/schema.sql` and the migrations to a throwaway local PostgreSQL,
inserts fixture rows in every backed-up table (including a response to a retired question),
exports, empties the tables and the content they reference, restores, exports again and
compares the files byte for byte. It then restores a second time and checks that nothing
changed. It refuses to run against anything but a local database.

```bash
docker run -d --name et-rehearsal -e POSTGRES_PASSWORD=rehearsal -p 127.0.0.1:55439:5432 postgres:17-alpine
REHEARSAL_DATABASE_URL=postgresql://postgres:rehearsal@127.0.0.1:55439/postgres pnpm backup:rehearse
docker rm -f et-rehearsal
```

Stand-ins for Supabase (`auth.users`, `auth.uid()`, the roles and `cron.schedule`) live in
`scripts/backup/rehearsal-bootstrap.sql`. Four migrations are skipped because
`seeds/schema.sql` already contains their objects. Run the rehearsal again whenever the
export, the restore or the schema changes.

Last rehearsal: 2026-11-15, passing through the direct PostgreSQL path. Reviewing it found
problems that are now fixed: a repeated restore duplicated answer events, content ids were
not preserved, and responses to retired questions were rejected.

Not covered by the rehearsal: the Supabase API write path (`auth.admin.createUser` and table
upserts) cannot run against a local database and has never been run against a Supabase
project. On 2026-11-15 a read-only comparison of a fresh export against the live project
showed no rows to write, which exercised the API read path only. Restore into a scratch
Supabase project before relying on the API path.

## Yearly access review

Add these to the yearly access review:

- GitHub repository `ravidorr/easy-theory-backups` (collaborators, and the one deploy key
  titled "easy-theory daily backup").
- The `database-backup` environment secrets: `BACKUP_DEPLOY_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`.

Rotate the deploy key by generating a new ed25519 pair, replacing the deploy key and the
secret, and removing the old key.
