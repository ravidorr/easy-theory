import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { postgresClient, supabaseClient } from "./backup/clients";
import { rowIdentity, serialize, sortRows } from "./backup/stable";
import {
  BACKUP_TABLES,
  BackupError,
  USERS_FILE,
  type BackupTable,
  type BackupClient,
  type Row,
} from "./backup/tables";

export const PAGE_SIZE = 1000;
const READ_ATTEMPTS = 3;
export const MANIFEST_FILE = "manifest.json";

export type Manifest = { tables: Record<string, number> };

function hasDuplicates(rows: Row[], key: readonly string[]): boolean {
  return new Set(rows.map((row) => rowIdentity(row, key))).size !== rows.length;
}

async function readTable(client: BackupClient, table: BackupTable): Promise<Row[]> {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    const rows: Row[] = [];
    let expected = 0;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await client.readPage(table.name, table.key, offset, PAGE_SIZE);
      expected = page.count;
      rows.push(...page.rows);
      if (page.rows.length < PAGE_SIZE) break;
    }
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
    let expected = 0;
    for (let page = 1; ; page += 1) {
      const batch = await client.listUsers(page, PAGE_SIZE);
      expected = batch.total;
      users.push(...batch.users);
      if (batch.users.length < PAGE_SIZE) break;
    }
    if (users.length === expected && !hasDuplicates(users, ["id"])) return users;
  }
  throw new BackupError(`read of auth users was inconsistent after ${READ_ATTEMPTS} attempts`);
}

/**
 * Reads every table fully before writing anything, so a failure never leaves a partial export.
 * Returns row counts only.
 */
export async function exportBackup(client: BackupClient, outDir: string): Promise<Manifest> {
  const files = new Map<string, Row[]>();
  files.set(USERS_FILE, sortRows(await readUsers(client), ["id"]));
  for (const table of BACKUP_TABLES) {
    files.set(table.name, sortRows(await readTable(client, table), table.key));
  }

  mkdirSync(outDir, { recursive: true });
  const manifest: Manifest = { tables: {} };
  for (const [name, rows] of files) {
    manifest.tables[name] = rows.length;
    const target = path.join(outDir, `${name}.json`);
    writeFileSync(`${target}.partial`, serialize(rows));
    renameSync(`${target}.partial`, target);
  }
  writeFileSync(path.join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
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
    for (const [name, count] of Object.entries(manifest.tables)) console.log(`${name}: ${count}`);
    console.log(`backup:export - ${describeCounts(manifest)} written to ${outDir}`);
  } catch (error) {
    console.error(`backup:export - ${error instanceof Error ? error.message : "unknown failure"}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
