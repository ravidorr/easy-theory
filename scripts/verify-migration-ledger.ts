import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  compareLedger,
  discoverMigrations,
  type MigrationLedgerEntry,
} from "./audit-database-metadata";

export class LedgerVerificationError extends Error {}

export function shouldVerifyMigrationLedger(
  args: string[],
  values = process.env
): boolean {
  return (
    args.includes("--require") ||
    values.VERCEL_ENV === "production" ||
    values.MIGRATION_LEDGER_GATE === "1"
  );
}

export function assertMigrationLedger(
  actual: MigrationLedgerEntry[]
): void {
  const difference = compareLedger(discoverMigrations(), actual);
  if (difference.productionOnly.length > 0 || difference.qaOnly.length > 0) {
    throw new LedgerVerificationError(
      `migration ledger drift (missing-or-changed: ${difference.productionOnly.join(", ") || "none"}; unexpected: ${
        difference.qaOnly.join(", ") || "none"
      })`
    );
  }
}

async function fetchLedger(values = process.env): Promise<MigrationLedgerEntry[]> {
  const url = values.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = values.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new LedgerVerificationError(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the production migration ledger gate"
    );
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client
    .from("schema_migrations")
    .select("version, filename, checksum, applied_at")
    .order("version");
  if (error) throw new LedgerVerificationError(`could not read schema_migrations: ${error.message}`);

  return (data ?? []).map((entry) => ({
    version: entry.version,
    filename: entry.filename,
    checksum: entry.checksum,
    appliedAt: entry.applied_at,
  }));
}

export async function main(args = process.argv.slice(2), values = process.env): Promise<void> {
  if (!shouldVerifyMigrationLedger(args, values)) {
    console.log(
      "db:verify-ledger - skipped outside an enabled deployment gate (pass --require to enforce)"
    );
    return;
  }

  try {
    assertMigrationLedger(await fetchLedger(values));
    console.log(`db:verify-ledger - current through ${discoverMigrations().at(-1)?.version ?? 0}`);
  } catch (error) {
    console.error(`db:verify-ledger - ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = error instanceof LedgerVerificationError ? 2 : 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
