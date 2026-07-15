# QA Environment Setup (one-time)

The QA agent runs against a **dedicated test Supabase project** with known seeded data —
never against production. This document is the one-time setup; after it, every QA run is
just `/qa-explore <charter>`.

## 1. Create the test Supabase project

1. In the [Supabase dashboard](https://supabase.com/dashboard), create a new project
   (free tier is fine), e.g. `clear-road-qa`.
2. In **Authentication → Sign In / Providers**, make sure the **Email** provider is
   enabled. Nothing else is needed — the test user is created programmatically with a
   confirmed email, and login links are minted via the admin API (no emails are sent).
3. In **Authentication → URL Configuration**, add `http://localhost:3100/auth/callback`
   to **Redirect URLs** and set **Site URL** to `http://localhost:3100`. Without this,
   `POST /api/auth/send-otp` returns 500 when charter `008-auth-and-login-edges` exercises
   real OTP delivery.
4. Note from **Settings → API**: the project URL, the `anon` key, and the
   `service_role` key.

## 2. Seed the database

In the project's **SQL editor**, run these files in exactly this order:

1. `seeds/schema.sql`
2. `seeds/topics.sql`
3. `seeds/questions.sql`
4. `seeds/signs.sql`
5. `seeds/signs_names_patch.sql`
6. `seeds/rate_limits.sql`
7. **every file in `seeds/migrations/` in filename order** (as of this writing:
   `001_quiz_responses_unique.sql`, `002_fix_correct_options.sql`,
   `003_fix_sign_102_name.sql`, `004_quiz_responses_update_policy.sql`,
   `005_arabic_columns.sql`, `006_quiz_responses_session_id.sql`,
   `007_exam_attempts.sql`, `008_replace_user_schedule.sql`,
   `009_schedule_locale.sql`, `010_quiz_submission_idempotency.sql`,
   `011_fix_sign_409_correct_answer.sql`, `012_videos_resources.sql`,
   `013_question_bookmarks.sql`)

**Keep the QA project's schema in sync**: whenever a new file lands in
`seeds/migrations/`, run it in the QA project's SQL editor too. The app's code assumes
all migrations are applied — a stale QA schema fails mid-run (e.g. every quiz
submission 500s), and `pnpm qa:mint --check` now probes one schema object per
migration to catch this drift in preflight.

Sanity-check the result:

```sql
select count(*) from questions; -- 1273 (the seed file's exact row count; README's "1,802" is the pre-dedup source figure)
select count(*) from signs;     -- 277
select count(*) from topics;    -- non-empty
```

## 3. Create `.env.qa`

Copy `.env.qa.example` to `.env.qa` (it stays gitignored — it holds the service-role
key) and fill in the three real values from step 1.

**Why every variable must be present:** Next.js gives shell environment variables
precedence over `.env.local`, and `pnpm qa:dev` exports `.env.qa` into the shell. But
any variable *missing* from `.env.qa` silently falls back to the production value in
`.env.local`. The dummy entries in the example file exist to block that leak — keep
them.

## 4. Test user

Nothing to do — `pnpm qa:mint` auto-creates `qa-user@clearroad.test` (with a confirmed
email) on first run.

## 5. Smoke-check the setup

```bash
pnpm qa:dev            # starts Next on http://localhost:3100 against the QA project
pnpm qa:mint --check   # verifies connectivity + seed counts
pnpm qa:mint           # prints a one-time login URL
```

Open the printed URL in a fresh browser window: you should land authenticated on
`http://localhost:3100/he` (the dashboard). If you land on `/he/auth/login?error=1`, the
token was already used or expired — mint a fresh one.

Both `qa:dev` and `qa:mint` refuse to run if `.env.qa` is missing, if `QA_ENV=1` is not
set, or if the Supabase URL matches the one in `.env.local` (production).

## 6. Resetting the test user (optional)

To start a run from a clean slate, wipe the test user's data in the SQL editor:

```sql
delete from user_quiz_responses
  where user_id in (select id from auth.users where email = 'qa-user@clearroad.test');
delete from user_topic_progress
  where user_id in (select id from auth.users where email = 'qa-user@clearroad.test');
delete from user_stats
  where user_id in (select id from auth.users where email = 'qa-user@clearroad.test');
delete from user_medals
  where user_id in (select id from auth.users where email = 'qa-user@clearroad.test');
delete from user_schedule
  where user_id in (select id from auth.users where email = 'qa-user@clearroad.test');
```

Charters that assume prior progress (like `001-home-and-quiz`) work either way — they
compare progress before/after within the run.
