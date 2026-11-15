import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { postgresClient, supabaseClient } from "./backup/clients";
import { rowIdentity, serialize, sortRows } from "./backup/stable";
import {
  ARRAY_REFERENCES,
  BACKUP_TABLES,
  BackupError,
  REFERENCES,
  USERS_FILE,
  type BackupTable,
  type BackupClient,
  type Row,
} from "./backup/tables";

export const PAGE_SIZE = 1000;
const READ_ATTEMPTS = 3;
export const MANIFEST_FILE = "manifest.json";

/** Only messages this code wrote are printed: database driver errors can quote row values. */
export function safeMessage(error: unknown): string {
  return error instanceof BackupError ? error.message : "unexpected failure";
}

export type Manifest = { tables: Record<string, number> };

function hasDuplicates(rows: Row[], key: readonly string[]): boolean {
  return new Set(rows.map((row) => rowIdentity(row, key))).size !== rows.length;
}

async function readTable(client: BackupClient, table: BackupTable): Promise<Row[]> {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    const rows: Row[] = [];
    const counts = new Set<number>();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await client.readPage(table.name, table.pageOrder ?? table.key, offset, PAGE_SIZE);
      counts.add(page.count);
      rows.push(...page.rows);
      if (page.rows.length < PAGE_SIZE) break;
    }
    // Every page must report the same total, otherwise rows moved between pages and one may have been skipped.
    const expected = counts.size === 1 ? [...counts][0] : -1;
    // Rows written while paging shift the pages: a different count or a repeated key means a bad read.
    // Tables without a primary key can hold repeated identities legitimately, so only the count is checked.
    const repeated = !table.insertMissing && hasDuplicates(rows, table.key);
    if (rows.length === expected && !repeated) return rows;
  }
  throw new BackupError(`read of ${table.name} was inconsistent after ${READ_ATTEMPTS} attempts`);
}

async function readUsers(client: BackupClient): Promise<Row[]> {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    const users: Row[] = [];
    const totals = new Set<number>();
    for (let page = 1; ; page += 1) {
      const batch = await client.listUsers(page, PAGE_SIZE);
      totals.add(batch.total);
      users.push(...batch.users);
      if (batch.users.length < PAGE_SIZE) break;
    }
    const expected = totals.size === 1 ? [...totals][0] : -1;
    if (users.length === expected && !hasDuplicates(users, ["id"])) return users;
  }
  throw new BackupError(`read of auth users was inconsistent after ${READ_ATTEMPTS} attempts`);
}

async function readAll(client: BackupClient): Promise<Map<string, Row[]>> {
  const files = new Map<string, Row[]>();
  files.set(USERS_FILE, sortRows(await readUsers(client), ["id"]));
  for (const table of BACKUP_TABLES) {
    files.set(table.name, sortRows(await readTable(client, table), table.key));
  }
  return files;
}

/** Counts rows that point at an id missing from the export. Happens when rows are written between table reads. */
export function danglingReferences(files: Map<string, Row[]>): number {
  const ids = new Map<string, Set<unknown>>();
  for (const [name, rows] of files) ids.set(name, new Set(rows.map((row) => row.id)));
  let dangling = 0;
  for (const [name, rows] of files) {
    for (const row of rows) {
      for (const [column, target] of Object.entries(REFERENCES)) {
        const value = row[column];
        if (name !== target && value != null && !ids.get(target)!.has(value)) dangling += 1;
      }
      for (const [column, target] of Object.entries(ARRAY_REFERENCES)) {
        const values = row[column];
        if (Array.isArray(values)) dangling += values.filter((value) => !ids.get(target)!.has(value)).length;
      }
    }
  }
  return dangling;
}

/**
 * Reads every table fully before writing any file, so a read failure leaves nothing behind.
 * The manifest is written last. Returns row counts only.
 */
export async function exportBackup(client: BackupClient, outDir: string): Promise<Manifest> {
  let files = await readAll(client);
  // Tables are read one after another, so a user who signs up in between would leave rows without their account.
  for (let attempt = 1; danglingReferences(files) > 0; attempt += 1) {
    if (attempt === READ_ATTEMPTS) {
      throw new BackupError(`export has rows that reference missing ids after ${READ_ATTEMPTS} attempts`);
    }
    files = await readAll(client);
  }

  mkdirSync(outDir, { recursive: true });
  const manifest: Manifest = { tables: {} };
  for (const [name, rows] of files) {
    manifest.tables[name] = rows.length;
    const target = path.join(outDir, `${name}.json`);
    writeFileSync(`${target}.partial`, serialize(rows));
    renameSync(`${target}.partial`, target);
  }
  const manifestPath = path.join(outDir, MANIFEST_FILE);
  writeFileSync(`${manifestPath}.partial`, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(`${manifestPath}.partial`, manifestPath);
  return manifest;
}

export function describeCounts(manifest: Manifest): string {
  const counts = Object.values(manifest.tables);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return `${total} rows in ${counts.length} tables`;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  try {
    const outDir = args[0] ?? mkdtempSync(path.join(process.env.RUNNER_TEMP ?? "/tmp", "backup-export-"));
    const databaseUrl = process.env.BACKUP_DATABASE_URL;
    const client = databaseUrl ? postgresClient(databaseUrl) : supabaseClient();
    let manifest: Manifest;
    try {
      manifest = await exportBackup(client, outDir);
    } finally {
      if ("end" in client) await (client as { end(): Promise<void> }).end();
    }
    // A wrong key or a policy change can return no rows and no error. An empty backup must not replace a good one.
    if (!manifest.tables[USERS_FILE]) throw new BackupError("export has no auth users, refusing to publish it");
    for (const [name, count] of Object.entries(manifest.tables)) console.log(`${name}: ${count}`);
    console.log(`backup:export - ${describeCounts(manifest)} written to ${outDir}`);
  } catch (error) {
    console.error(`backup:export - ${safeMessage(error)}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
