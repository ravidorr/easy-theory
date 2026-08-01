import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import {
  compareLedger,
  discoverMigrations,
  type MigrationFile,
  type MigrationLedgerEntry,
} from "./audit-database-metadata";

export type MigrationTarget = "qa" | "production";

export type MigrationArguments = {
  target: MigrationTarget;
  apply: boolean;
};

export class MigrationApplicationError extends Error {}

const LOCK_NAME = "easy-theory-schema-migrations";

export function parseMigrationArguments(args: string[]): MigrationArguments {
  let target: MigrationTarget | undefined;
  let apply = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--target") {
      const value = args[index + 1];
      if (value !== "qa" && value !== "production") {
        throw new MigrationApplicationError("--target must be qa or production");
      }
      if (target) throw new MigrationApplicationError("--target may only be supplied once");
      target = value;
      index += 1;
      continue;
    }
    throw new MigrationApplicationError(`unknown argument: ${argument}`);
  }

  if (!target) throw new MigrationApplicationError("--target qa|production is required");
  return { target, apply };
}

export function databaseUrlForTarget(
  target: MigrationTarget,
  values = process.env
): string {
  const variable = target === "qa" ? "QA_DATABASE_URL" : "PROD_DATABASE_URL";
  const value = values[variable];
  if (!value) throw new MigrationApplicationError(`${variable} is required`);
  try {
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith("postgres")) throw new Error("not PostgreSQL");
  } catch {
    throw new MigrationApplicationError(`${variable} must be a PostgreSQL connection string`);
  }
  return value;
}

export function pendingMigrations(
  expected: MigrationFile[],
  actual: MigrationLedgerEntry[]
): MigrationFile[] {
  if (actual.length > expected.length) {
    throw new MigrationApplicationError("migration ledger has more rows than this commit");
  }

  for (const [index, entry] of actual.entries()) {
    const expectedEntry = expected[index];
    if (
      !expectedEntry ||
      entry.version !== expectedEntry.version ||
      entry.filename !== expectedEntry.filename ||
      entry.checksum !== expectedEntry.checksum
    ) {
      const difference = compareLedger(expected, actual);
      throw new MigrationApplicationError(
        `migration ledger is not an exact committed prefix (missing-or-changed: ${difference.productionOnly.join(
          ", "
        ) || "none"}; unexpected: ${difference.qaOnly.join(", ") || "none"})`
      );
    }
  }

  return expected.slice(actual.length);
}

async function fetchLedger(sql: postgres.Sql): Promise<MigrationLedgerEntry[]> {
  try {
    const rows = await sql<
      Array<{ version: number; filename: string; checksum: string; applied_at: string }>
    >`SELECT version, filename, checksum, applied_at::text FROM public.schema_migrations ORDER BY version`;
    return rows.map((row) => ({
      version: row.version,
      filename: row.filename,
      checksum: row.checksum,
      appliedAt: row.applied_at,
    }));
  } catch (error) {
    if (error instanceof postgres.PostgresError && error.code === "42P01") {
      throw new MigrationApplicationError(
        "public.schema_migrations is missing; bootstrap through migration 023 before using this runner"
      );
    }
    throw error;
  }
}

async function applyPendingMigrations(options: MigrationArguments): Promise<void> {
  const databaseUrl = databaseUrlForTarget(options.target);
  const expected = discoverMigrations();
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  let locked = false;

  try {
    await sql`SELECT pg_advisory_lock(hashtext(${LOCK_NAME}))`;
    locked = true;
    const before = await fetchLedger(sql);
    const pending = pendingMigrations(expected, before);
    const label = options.target.toUpperCase();

    if (pending.length === 0) {
      console.log(`${label} migration ledger is current through ${expected.at(-1)?.version ?? 0}`);
      return;
    }

    console.log(
      `${label} pending migrations: ${pending.map(({ filename }) => filename).join(", ")}${
        options.apply ? "" : " (dry run)"
      }`
    );
    if (!options.apply) return;

    for (const migration of pending) {
      console.log(`Applying ${migration.filename}`);
      await sql.unsafe(readFileSync(path.join("seeds/migrations", migration.filename), "utf8"));
      const after = await fetchLedger(sql);
      pendingMigrations(expected, after);
    }

    const finalLedger = await fetchLedger(sql);
    if (pendingMigrations(expected, finalLedger).length !== 0) {
      throw new MigrationApplicationError("migration ledger did not reach the committed version");
    }
    console.log(`${label} migration ledger is current through ${expected.at(-1)?.version ?? 0}`);
  } finally {
    if (locked) await sql`SELECT pg_advisory_unlock(hashtext(${LOCK_NAME}))`;
    await sql.end({ timeout: 5 });
  }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  try {
    await applyPendingMigrations(parseMigrationArguments(args));
  } catch (error) {
    console.error(`db:migrate - ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = error instanceof MigrationApplicationError ? 2 : 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
