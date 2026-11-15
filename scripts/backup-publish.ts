import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BACKUP_TABLES, BackupError, USERS_FILE } from "./backup/tables";
import { describeCounts, MANIFEST_FILE, safeMessage, type Manifest } from "./backup-export";

// History is reset on the first run after the oldest commit passes this age. With daily runs that is the
// day-30 run, so history is replaced about every 30 days. A missed run delays the reset.
export const MAX_HISTORY_DAYS = 29;
export type PublishResult = "unchanged" | "committed" | "reset";

const IDENTITY = ["-c", "user.name=backup-bot", "-c", "user.email=backup-bot@users.noreply.github.com"];

function git(repoDir: string, ...args: string[]): string {
  return execFileSync("git", [...IDENTITY, ...args], { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function historyIsStale(repoDir: string, now: Date, maxDays = MAX_HISTORY_DAYS): boolean {
  // Fails loudly outside a git repository, so a broken checkout cannot look like fresh history.
  git(repoDir, "rev-parse", "--git-dir");
  try {
    git(repoDir, "rev-parse", "--verify", "--quiet", "HEAD");
  } catch {
    return false;
  }
  const firstCommit = git(repoDir, "log", "--max-parents=0", "--format=%ct", "HEAD").split("\n").at(-1) ?? "";
  if (!/^\d+$/.test(firstCommit)) throw new BackupError("could not read the age of the backup history");
  return now.getTime() - Number(firstCommit) * 1000 > maxDays * 24 * 60 * 60 * 1000;
}

/** Every expected file must exist, be a list, and match the manifest count, so a short export is never committed. */
export function verifyExport(exportDir: string, manifest: Manifest): void {
  for (const name of [USERS_FILE, ...BACKUP_TABLES.map((table) => table.name)]) {
    const file = path.join(exportDir, `${name}.json`);
    if (!existsSync(file)) throw new BackupError(`export is missing ${name}.json`);
    const rows: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(rows) || rows.length !== manifest.tables[name]) {
      throw new BackupError(`${name}.json does not match the manifest`);
    }
  }
}

function syncFiles(repoDir: string, exportDir: string): void {
  for (const entry of readdirSync(repoDir)) {
    if (entry.endsWith(".json")) rmSync(path.join(repoDir, entry));
  }
  for (const entry of readdirSync(exportDir)) {
    if (entry.endsWith(".json")) cpSync(path.join(exportDir, entry), path.join(repoDir, entry));
  }
}

/**
 * Copies the export into a checked-out backup repository and commits it.
 * When the oldest commit is older than the retention window, history is replaced by one
 * orphan commit, so accounts deleted since then no longer appear in any reachable commit.
 * The caller pushes: a plain push for "committed", a forced push for "reset".
 */
export function publishBackup(repoDir: string, exportDir: string, now = new Date()): PublishResult {
  if (!existsSync(path.join(exportDir, MANIFEST_FILE))) throw new BackupError("export has no manifest");
  const manifest = JSON.parse(readFileSync(path.join(exportDir, MANIFEST_FILE), "utf8")) as Manifest;
  verifyExport(exportDir, manifest);
  const message = `Backup: ${describeCounts(manifest)}`;

  syncFiles(repoDir, exportDir);
  const stale = historyIsStale(repoDir, now);
  if (stale) {
    const branch = git(repoDir, "rev-parse", "--abbrev-ref", "HEAD");
    git(repoDir, "checkout", "-q", "--orphan", "fresh-history");
    git(repoDir, "add", "-A");
    git(repoDir, "commit", "-m", `${message} (history reset)`);
    git(repoDir, "branch", "-M", branch);
    return "reset";
  }

  git(repoDir, "add", "-A");
  if (!git(repoDir, "status", "--porcelain")) return "unchanged";
  git(repoDir, "commit", "-m", message);
  return "committed";
}

export function main(args = process.argv.slice(2)): void {
  try {
    const [repoDir, exportDir] = args;
    if (!repoDir || !exportDir) throw new BackupError("usage: backup:publish <repo dir> <export dir>");
    console.log(`backup:publish - ${publishBackup(repoDir, exportDir)}`);
  } catch (error) {
    console.error(`backup:publish - ${safeMessage(error)}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main();
}
