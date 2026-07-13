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
  console.error(`qa:mint — ${message}`);
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

async function checkSeeds(): Promise<void> {
  const expected: Record<string, number> = { topics: 1, questions: 1273, signs: 277 };
  let failures = 0;
  for (const [table, minRows] of Object.entries(expected)) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.error(`qa:mint --check — ${table}: ${error.message}`);
      failures += 1;
      continue;
    }
    console.error(`qa:mint --check — ${table}: ${count ?? 0} rows`);
    if ((count ?? 0) < minRows) failures += 1;
  }
  if (failures > 0) {
    fail("QA database is unreachable or not fully seeded. See qa/SETUP.md.");
  }
  console.error("qa:mint --check — OK");
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
    `qa:mint — one-time session link for ${EMAIL} (expires on first use or OTP expiry):`
  );
  console.log(
    `${BASE_URL}/auth/callback?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(NEXT_PATH)}`
  );
}

(CHECK ? checkSeeds() : mint()).catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
