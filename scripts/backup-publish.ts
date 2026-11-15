import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BackupError } from "./backup/tables";
import { describeCounts, MANIFEST_FILE, type Manifest } from "./backup-export";

// One day under the 30 day promise, so a daily run with schedule jitter never lets history reach 31 days.
export const MAX_HISTORY_DAYS = 29;
export type PublishResult = "unchanged" | "committed" | "reset";

const IDENTITY = ["-c", "user.name=backup-bot", "-c", "user.email=backup-bot@users.noreply.github.com"];

function git(repoDir: string, ...args: string[]): string {
  return execFileSync("git", [...IDENTITY, ...args], { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function historyIsStale(repoDir: string, now: Date, maxDays = MAX_HISTORY_DAYS): boolean {
  let firstCommit: string;
  try {
    firstCommit = git(repoDir, "log", "--max-parents=0", "--format=%ct", "HEAD").split("\n").at(-1) ?? "";
  } catch {
    return false;
  }
  if (!firstCommit) return false;
  return now.getTime() - Number(firstCommit) * 1000 > maxDays * 24 * 60 * 60 * 1000;
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
    console.error(`backup:publish - ${error instanceof Error ? error.message : "unknown failure"}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main();
}
