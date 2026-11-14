import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const MIGRATIONS_DIRECTORY = "seeds/migrations";
const EXAMPLE_LIMIT = 10;

export type AuditConfig = {
  label: "production";
  databaseUrl: string;
};

export type MigrationFile = {
  version: number;
  filename: string;
  checksum: string;
};

export type MigrationLedgerEntry = MigrationFile & {
  appliedAt: string;
};

export type LedgerDifference = {
  missingOrChanged: string[];
  unexpected: string[];
};

export class AuditConfigurationError extends Error {}

export function loadAuditConfig(values = process.env): AuditConfig {
  const databaseUrl = values.PROD_DATABASE_URL;
  if (!databaseUrl) {
    throw new AuditConfigurationError(
      "direct audit requires PROD_DATABASE_URL (a PostgreSQL connection string)"
    );
  }
  try {
    const parsed = new URL(databaseUrl);
    if (!parsed.protocol.startsWith("postgres")) {
      throw new Error("not PostgreSQL");
    }
  } catch {
    throw new AuditConfigurationError("production direct audit URL must be a PostgreSQL connection string");
  }
  return { label: "production", databaseUrl };
}

export function normalizeMigrationSource(source: string): string {
  return `${source
    .replace(
      /(\(\s*\d+\s*,\s*'[^']+'\s*,\s*)'(?:[0-9a-f]{64}|<[^']+>|PLACEHOLDER)'(\s*\))/gi,
      "$1'<checksum>'$2"
    )
    .trimEnd()}\n`;
}

export function checksumMigrationSource(source: string): string {
  return createHash("sha256").update(normalizeMigrationSource(source)).digest("hex");
}

export function discoverMigrations(directory = MIGRATIONS_DIRECTORY): MigrationFile[] {
  const files = readdirSync(directory)
    .filter((filename) => /^\d{3}_.+\.sql$/.test(filename))
    .sort();
  return files.map((filename) => {
    const version = Number(filename.slice(0, 3));
    return {
      version,
      filename,
      checksum: checksumMigrationSource(readFileSync(path.join(directory, filename), "utf8")),
    };
  });
}

export function compareLedger(
  expected: MigrationFile[],
  actual: MigrationLedgerEntry[]
): LedgerDifference {
  const expectedRows = new Map(expected.map((entry) => [entry.version, entry]));
  const actualRows = new Map(actual.map((entry) => [entry.version, entry]));
  const describe = (entry: MigrationFile) => `${String(entry.version).padStart(3, "0")} ${entry.filename}`;
  return {
    missingOrChanged: expected
      .filter((entry) => {
        const found = actualRows.get(entry.version);
        return !found || found.filename !== entry.filename || found.checksum !== entry.checksum;
      })
      .map(describe),
    unexpected: actual
      .filter((entry) => {
        const found = expectedRows.get(entry.version);
        return !found || found.filename !== entry.filename || found.checksum !== entry.checksum;
      })
      .map(describe),
  };
}

export async function fetchLedger(config: AuditConfig): Promise<MigrationLedgerEntry[]> {
  const sql = postgres(config.databaseUrl, { max: 1, prepare: false });
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
      throw new Error(`${config.label} is missing public.schema_migrations; apply migration 023 first`);
    }
    throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function ledgerHasDrift({ missingOrChanged, unexpected }: LedgerDifference): boolean {
  return missingOrChanged.length > 0 || unexpected.length > 0;
}

export function renderLedgerReport(ledger: LedgerDifference): string {
  const lines = [
    `Database migration ledger audit: ${ledgerHasDrift(ledger) ? "DRIFT FOUND" : "ALIGNED"}`,
    "",
    `  production: missing-or-changed=${ledger.missingOrChanged.length}, unexpected=${ledger.unexpected.length}`,
  ];
  const examples = [
    ...ledger.missingOrChanged.map((entry) => `${entry} [missing or changed]`),
    ...ledger.unexpected.map((entry) => `${entry} [unexpected]`),
  ];
  if (examples.length > 0) lines.push(`    examples: ${examples.slice(0, EXAMPLE_LIMIT).join("; ")}`);
  return lines.join("\n");
}

export async function main(): Promise<void> {
  try {
    const production = loadAuditConfig();
    const ledger = compareLedger(discoverMigrations(), await fetchLedger(production));
    console.log(renderLedgerReport(ledger));
    process.exitCode = ledgerHasDrift(ledger) ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`db:audit - ${message}`);
    process.exitCode = error instanceof AuditConfigurationError ? 2 : 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
