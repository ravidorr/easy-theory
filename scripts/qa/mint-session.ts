/**
 * QA session minting: prints a one-time login URL for the QA test user so a
 * browser agent can authenticate without email access. Uses the Supabase
 * admin API (generateLink) and the app's existing /auth/callback token_hash
 * flow — no product-code changes.
 *
 * Usage:
 *   pnpm qa:mint                          # print a one-time login URL (stdout, single line)
 *   pnpm qa:mint --check                  # verify connectivity + seeded data, no minting
 *   pnpm qa:mint --email qa2@example.com  # different test user (auto-created)
 *   pnpm qa:mint --next /he/flashcards    # post-login landing path
 *   pnpm qa:mint --base http://localhost:3100
 *
 * Only the URL goes to stdout; all diagnostics go to stderr, so callers can
 * capture the link with `URL=$(pnpm --silent qa:mint)`.
 */

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function arg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const CHECK = process.argv.includes("--check");
const EMAIL = arg("--email") ?? "qa-user@clearroad.test";
const NEXT_PATH = arg("--next") ?? "/he";
const BASE_URL = arg("--base") ?? "http://localhost:3100";

function fail(message: string): never {
  console.error(`qa:mint - ${message}`);
  process.exit(1);
}

// ── Safety guards ──────────────────────────────────────────────────────────

if (process.env.QA_ENV !== "1") {
  fail(
    "refusing to run: QA_ENV=1 is not set. Run via `pnpm qa:mint` so .env.qa is loaded (see qa/SETUP.md)."
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  fail(".env.qa must define NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

// .env.local points at production; refuse to mint against the same project.
if (existsSync(".env.local")) {
  const prodUrl = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((line) => line.startsWith("NEXT_PUBLIC_SUPABASE_URL="))
    ?.slice("NEXT_PUBLIC_SUPABASE_URL=".length)
    .trim();
  if (prodUrl && prodUrl === url) {
    fail(
      "refusing to run against the Supabase project in .env.local (production). Point .env.qa at the QA project."
    );
  }
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── --check: connectivity + seed sanity (used by the qa-explore preflight) ──

// Row counts alone gave false confidence once: the QA project had all the data
// but predated migrations 007-010, so every quiz submission 500'd mid-run.
// Probe one cheap schema object per migration the app depends on. Auth-gated
// RPCs are probed with dummy args and must raise not_authenticated (P0001);
// reaching that raise proves the function exists without mutating anything.
// Probing RPCs with empty args is ambiguous: PGRST202 then only means the
// zero-arg overload is absent, not that the function is missing.
async function checkSchema(): Promise<number> {
  let failures = 0;

  const columnProbes = [
    { table: "user_quiz_responses", column: "session_id", migration: "006" },
    { table: "user_exam_attempts", column: "id", migration: "007" },
    { table: "user_schedule", column: "locale", migration: "009" },
    { table: "videos", column: "youtube_id", migration: "012" },
    { table: "resources", column: "href", migration: "012" },
  ];
  for (const { table, column, migration } of columnProbes) {
    const { error } = await admin.from(table).select(column, { count: "exact", head: true });
    if (error) {
      console.error(
        `qa:mint --check - schema ${table}.${column} (migration ${migration}): ${error.message}`
      );
      failures += 1;
    } else {
      console.error(`qa:mint --check - schema ${table}.${column} (migration ${migration}): ok`);
    }
  }

  const NIL_UUID = "00000000-0000-0000-0000-000000000000";
  const rpcProbes = [
    {
      fn: "replace_user_schedule",
      migration: "008/009",
      args: { p_days: [], p_start_time: "00:00", p_duration_minutes: 45, p_notify: true, p_locale: "he" },
    },
    {
      fn: "submit_quiz_answer",
      migration: "010",
      args: {
        p_idempotency_key: "qa-check-probe",
        p_question_id: NIL_UUID,
        p_selected_option: "a",
        p_session_id: NIL_UUID,
        p_topic_id: NIL_UUID,
      },
    },
  ];
  for (const { fn, migration, args } of rpcProbes) {
    const { error } = await admin.rpc(fn, args);
    if (error && /not_authenticated/.test(error.message)) {
      console.error(`qa:mint --check - schema rpc ${fn} (migration ${migration}): ok`);
    } else {
      console.error(
        `qa:mint --check - schema rpc ${fn} (migration ${migration}): ${
          error ? error.message : "executed without raising not_authenticated"
        }`
      );
      failures += 1;
    }
  }

  return failures;
}

async function checkSeeds(): Promise<void> {
  const expected: Record<string, number> = {
    topics: 1,
    questions: 1273,
    signs: 277,
    videos: 6,
    resources: 4,
  };
  let failures = 0;
  for (const [table, minRows] of Object.entries(expected)) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.error(`qa:mint --check - ${table}: ${error.message}`);
      failures += 1;
      continue;
    }
    console.error(`qa:mint --check - ${table}: ${count ?? 0} rows`);
    if ((count ?? 0) < minRows) failures += 1;
  }
  failures += await checkSchema();
  if (failures > 0) {
    fail(
      "QA database is unreachable, not fully seeded, or its schema is missing migrations. See qa/SETUP.md."
    );
  }
  console.error("qa:mint --check - OK");
}

// ── Mint ───────────────────────────────────────────────────────────────────

async function mint(): Promise<void> {
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
  });
  if (
    created.error &&
    created.error.code !== "email_exists" &&
    !/already.*registered/i.test(created.error.message)
  ) {
    fail(`could not ensure test user exists: ${created.error.message}`);
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (error) {
    fail(`generateLink failed: ${error.message}`);
  }
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    fail("generateLink returned no hashed_token");
  }

  console.error(
    `qa:mint - one-time session link for ${EMAIL} (expires on first use or OTP expiry):`
  );
  console.log(
    `${BASE_URL}/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(NEXT_PATH)}`
  );
}

(CHECK ? checkSeeds() : mint()).catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
