import { readdirSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { postgresClient } from "./backup/clients";
import { BACKUP_TABLES, BackupError } from "./backup/tables";
import { exportBackup } from "./backup-export";
import { restoreBackup } from "./backup-restore";

/** Migrations whose objects seeds/schema.sql already contains, so they fail with "already exists" on top of it. */
export const SCHEMA_OVERLAP = new Set([
  "001_quiz_responses_unique.sql",
  "004_quiz_responses_update_policy.sql",
  "007_exam_attempts.sql",
  "013_question_bookmarks.sql",
]);

export function assertLocal(databaseUrl: string | undefined): string {
  if (!databaseUrl) throw new BackupError("REHEARSAL_DATABASE_URL is required");
  const host = new URL(databaseUrl).hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") {
    throw new BackupError("the rehearsal wipes data and only runs against a local database");
  }
  return databaseUrl;
}

export function migrationSql(source: string): string {
  // pg_cron is a Supabase extension that a plain local Postgres does not have; the bootstrap stubs cron.schedule.
  return source.replace("CREATE EXTENSION IF NOT EXISTS pg_cron;", "");
}

async function buildDatabase(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS cron CASCADE;");
    await sql.unsafe(readFileSync("scripts/backup/rehearsal-bootstrap.sql", "utf8"));
    await sql.unsafe(readFileSync("seeds/schema.sql", "utf8"));
    for (const file of readdirSync("seeds/migrations").filter((name) => name.endsWith(".sql")).sort()) {
      if (SCHEMA_OVERLAP.has(file)) continue;
      await sql.unsafe(migrationSql(readFileSync(path.join("seeds/migrations", file), "utf8")));
    }
    await sql.unsafe(readFileSync("scripts/backup/rehearsal-fixtures.sql", "utf8"));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function emptyTables(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const names = BACKUP_TABLES.map((table) => `public.${table.name}`).join(", ");
    await sql.unsafe(`TRUNCATE ${names}, auth.users CASCADE`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function sameFiles(a: string, b: string): string[] {
  return readdirSync(a).filter((name) => readFileSync(path.join(a, name), "utf8") !== readFileSync(path.join(b, name), "utf8"));
}

export async function main(): Promise<void> {
  try {
    const databaseUrl = assertLocal(process.env.REHEARSAL_DATABASE_URL);
    await buildDatabase(databaseUrl);
    const client = postgresClient(databaseUrl);
    try {
      const work = mkdtempSync(path.join(tmpdir(), "backup-rehearsal-"));
      const [before, after, again] = ["before", "after", "again"].map((name) => path.join(work, name));
      const manifest = await exportBackup(client, before);
      await emptyTables(databaseUrl);
      await restoreBackup(client, before);
      await exportBackup(client, after);
      await restoreBackup(client, before);
      await exportBackup(client, again);

      const rows = Object.values(manifest.tables).reduce((sum, count) => sum + count, 0);
      const differences = [...sameFiles(before, after), ...sameFiles(before, again)];
      console.log(`rehearsal - exported ${rows} fixture rows in ${Object.keys(manifest.tables).length} files`);
      if (differences.length) throw new BackupError(`restored data differs in: ${[...new Set(differences)].join(", ")}`);
      console.log("rehearsal - restored data matches the export, and a second restore changed nothing");
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error(`rehearsal - ${error instanceof Error ? error.message : "unknown failure"}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
