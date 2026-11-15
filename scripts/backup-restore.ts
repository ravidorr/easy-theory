import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { postgresClient, supabaseClient } from "./backup/clients";
import { rowIdentity, sortKeys } from "./backup/stable";
import {
  BACKUP_TABLES,
  BackupError,
  USERS_FILE,
  type RestoreClient,
  type Row,
} from "./backup/tables";
import { MANIFEST_FILE, PAGE_SIZE, type Manifest } from "./backup-export";

const CHUNK_SIZE = 500;

function readRows(dir: string, name: string): Row[] {
  const rows = JSON.parse(readFileSync(path.join(dir, `${name}.json`), "utf8")) as Row[];
  if (!Array.isArray(rows)) throw new BackupError(`${name}.json is not a list of rows`);
  return rows;
}

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += CHUNK_SIZE) {
    result.push(items.slice(index, index + CHUNK_SIZE));
  }
  return result;
}

async function existingRows(client: RestoreClient, table: string, key: readonly string[]) {
  const existing = new Map<string, string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await client.readPage(table, key, offset, PAGE_SIZE);
    for (const row of page.rows) existing.set(rowIdentity(row, key), JSON.stringify(sortKeys(row)));
    if (page.rows.length < PAGE_SIZE) return existing;
  }
}

/**
 * Upserts a backup into a project. Idempotent and additive: it never deletes anything.
 * Everything is validated against the manifest before the first write.
 */
export async function restoreBackup(client: RestoreClient, dir: string): Promise<Manifest> {
  const manifest = JSON.parse(readFileSync(path.join(dir, MANIFEST_FILE), "utf8")) as Manifest;
  const data = new Map<string, Row[]>();
  for (const name of [USERS_FILE, ...BACKUP_TABLES.map((table) => table.name)]) {
    const rows = readRows(dir, name);
    if (manifest.tables[name] !== rows.length) {
      throw new BackupError(`${name}.json does not match the manifest`);
    }
    data.set(name, rows);
  }

  for (const user of data.get(USERS_FILE)!) {
    if (!(await client.userExists(user.id as string))) await client.createUser(user);
  }

  // Rows that already match are skipped. Writing them again would fire the database triggers
  // (for example the quiz answer log) a second time and break idempotency.
  for (const table of BACKUP_TABLES) {
    const existing = await existingRows(client, table.name, table.key);
    const rows = data.get(table.name)!.filter((row) => {
      const current = existing.get(rowIdentity(row, table.key));
      return table.insertMissing ? current === undefined : current !== JSON.stringify(sortKeys(row));
    });
    for (const chunk of chunks(rows)) {
      if (table.insertMissing) await client.insertRows(table, chunk);
      else await client.upsertRows(table, chunk);
    }
  }
  return manifest;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  try {
    const dir = args[0];
    if (!dir) throw new BackupError("usage: backup:restore <backup directory>");
    const databaseUrl = process.env.RESTORE_DATABASE_URL;
    const client = databaseUrl ? postgresClient(databaseUrl) : supabaseClient();
    try {
      const manifest = await restoreBackup(client, dir);
      console.log(`backup:restore - restored ${Object.keys(manifest.tables).length} files`);
    } finally {
      if ("end" in client) await (client as { end(): Promise<void> }).end();
    }
  } catch (error) {
    console.error(`backup:restore - ${error instanceof Error ? error.message : "unknown failure"}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
