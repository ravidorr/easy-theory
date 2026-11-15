// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sortKeys, sortRows } from "../backup/stable";
import {
  BACKUP_TABLES,
  BackupError,
  type BackupTable,
  type RestoreClient,
  type Row,
} from "../backup/tables";
import { pickUserFields } from "../backup/clients";
import { describeCounts, exportBackup, PAGE_SIZE } from "../backup-export";
import { restoreBackup } from "../backup-restore";
import { historyIsStale, publishBackup } from "../backup-publish";

class FakeProject implements RestoreClient {
  tables = new Map<string, Row[]>();
  users: Row[] = [];
  calls: string[] = [];
  failOn?: string;
  drift = 0;
  shuffle = false;
  userTotalOffset = 0;

  constructor() {
    for (const table of BACKUP_TABLES) this.tables.set(table.name, []);
  }

  async readPage(table: string, key: readonly string[], offset: number, limit: number) {
    if (this.failOn === table) throw new BackupError(`read of ${table} failed (500)`);
    let rows = this.tables.get(table)!;
    if (this.shuffle) {
      // Unordered scan: rows come back in a different order each call.
      rows = [...rows].sort(() => Math.random() - 0.5);
    } else {
      rows = [...rows].sort((a, b) => (JSON.stringify(key.map((c) => a[c])) < JSON.stringify(key.map((c) => b[c])) ? -1 : 1));
    }
    return { rows: rows.slice(offset, offset + limit), count: rows.length + (this.drift-- > 0 ? 1 : 0) };
  }
  async listUsers(page: number, perPage: number) {
    return {
      users: this.users.slice((page - 1) * perPage, page * perPage),
      total: this.users.length + this.userTotalOffset,
    };
  }
  async userExists(id: string) {
    return this.users.some((user) => user.id === id);
  }
  async createUser(user: Row) {
    this.calls.push("createUser");
    this.users.push(user);
  }
  async upsertRows(table: BackupTable, rows: Row[]) {
    this.calls.push(`upsert:${table.name}`);
    const stored = this.tables.get(table.name)!;
    for (const row of rows) {
      const index = stored.findIndex((entry) => table.key.every((column) => entry[column] === row[column]));
      if (index >= 0) stored[index] = row;
      else stored.push(row);
    }
  }
  async insertRows(table: BackupTable, rows: Row[]) {
    this.calls.push(`insert:${table.name}`);
    this.tables.get(table.name)!.push(...rows);
  }
}

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "backup-test-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  dirs.length = 0;
});

function seeded(): FakeProject {
  const project = new FakeProject();
  project.users = [
    { id: "u2", email: "b@example.test", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: { z: 1, a: 2 } },
    { id: "u1", email: "a@example.test", email_confirmed_at: null, app_metadata: {}, user_metadata: {} },
  ];
  project.tables.set("user_stats", [
    { user_id: "u2", star_points: 5 },
    { user_id: "u1", star_points: 3 },
  ]);
  project.tables.set("quiz_answer_events", [
    { user_id: "u1", question_id: "q1", is_correct: true, answered_at: "2026-01-01T00:00:00Z" },
    { user_id: "u1", question_id: "q1", is_correct: false, answered_at: "2026-01-02T00:00:00Z" },
  ]);
  project.tables.set("user_exam_attempts", [{ id: "a1", user_id: "u1" }]);
  project.tables.set("user_exam_sessions", [{ id: "s1", user_id: "u1", attempt_id: "a1" }]);
  return project;
}

describe("stable output", () => {
  it("sorts keys recursively and rows by key", () => {
    expect(JSON.stringify(sortKeys({ b: [{ d: 1, c: 2 }], a: null }))).toBe('{"a":null,"b":[{"c":2,"d":1}]}');
    expect(sortRows([{ id: "b" }, { id: "a" }, { id: "c" }], ["id"]).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(sortRows([{ k: "x" }, { k: "x" }], ["k"])).toHaveLength(2);
    expect(sortRows([{ k: null }, { k: "a" }], ["k"])[1]).toEqual({ k: null });
  });

  it("keeps only the known user fields", () => {
    expect(Object.keys(pickUserFields({ id: "1", secret: "x" })).sort()).toEqual([
      "app_metadata", "created_at", "email", "email_confirmed_at", "id", "last_sign_in_at", "phone", "user_metadata",
    ]);
  });
});

describe("export", () => {
  it("writes one stable JSON file per table and a counts-only manifest", async () => {
    const dir = temp();
    const manifest = await exportBackup(seeded(), dir);
    expect(manifest.tables.auth_users).toBe(2);
    expect(manifest.tables.user_stats).toBe(2);
    expect(Object.keys(manifest.tables)).toHaveLength(BACKUP_TABLES.length + 1);
    expect(readdirSync(dir).filter((name) => name.endsWith(".partial"))).toEqual([]);
    const stats = JSON.parse(readFileSync(path.join(dir, "user_stats.json"), "utf8"));
    expect(stats.map((row: Row) => row.user_id)).toEqual(["u1", "u2"]);
    expect(readFileSync(path.join(dir, "auth_users.json"), "utf8")).toContain('"a": 2,\n      "z": 1');
    expect(describeCounts(manifest)).toBe("8 rows in 17 tables");
  });

  it("is byte-identical across runs", async () => {
    const [a, b] = [temp(), temp()];
    await exportBackup(seeded(), a);
    await exportBackup(seeded(), b);
    for (const name of readdirSync(a)) {
      expect(readFileSync(path.join(a, name), "utf8")).toBe(readFileSync(path.join(b, name), "utf8"));
    }
  });

  it("pages through more rows than one page", async () => {
    const project = new FakeProject();
    project.users = Array.from({ length: PAGE_SIZE + 5 }, (_, index) => ({ id: `u${index}` }));
    project.tables.set(
      "user_stats",
      Array.from({ length: PAGE_SIZE * 2 }, (_, index) => ({ user_id: `u${index}` }))
    );
    const manifest = await exportBackup(project, temp());
    expect(manifest.tables.auth_users).toBe(PAGE_SIZE + 5);
    expect(manifest.tables.user_stats).toBe(PAGE_SIZE * 2);
  });

  it("treats a repeated key in an unordered read as inconsistent", async () => {
    const project = new FakeProject();
    project.shuffle = true;
    project.tables.set(
      "user_stats",
      Array.from({ length: PAGE_SIZE + 200 }, (_, index) => ({ user_id: `u${index}` }))
    );
    await expect(exportBackup(project, temp())).rejects.toThrow(/inconsistent/);
  });

  it("fails when the auth user total does not match what was read", async () => {
    const project = seeded();
    project.userTotalOffset = 1;
    await expect(exportBackup(project, temp())).rejects.toThrow(/auth users was inconsistent/);
  });

  it("fails when auth user ids repeat", async () => {
    const project = seeded();
    project.users.push({ ...project.users[0] });
    await expect(exportBackup(project, temp())).rejects.toThrow(/auth users was inconsistent/);
  });

  it("allows repeated identities in a table without a primary key", async () => {
    const project = new FakeProject();
    const event = { user_id: "u1", question_id: "q1", is_correct: true, answered_at: "2026-01-01T00:00:00Z" };
    project.tables.set("quiz_answer_events", [event, { ...event }]);
    const manifest = await exportBackup(project, temp());
    expect(manifest.tables.quiz_answer_events).toBe(2);
  });

  it("fails loudly and writes nothing when a table cannot be read", async () => {
    const dir = path.join(temp(), "out");
    const project = seeded();
    project.failOn = "user_srs_cards";
    await expect(exportBackup(project, dir)).rejects.toThrow(/user_srs_cards/);
    expect(() => readdirSync(dir)).toThrow();
  });

  it("retries an inconsistent read once the table settles", async () => {
    const project = seeded();
    project.drift = 1;
    await expect(exportBackup(project, temp())).resolves.toBeDefined();
  });

  it("refuses a table that stays inconsistent", async () => {
    const project = seeded();
    project.drift = 1000;
    await expect(exportBackup(project, temp())).rejects.toThrow(/inconsistent/);
  });
});

describe("restore", () => {
  it("restores into an empty project, in foreign-key order, and round-trips", async () => {
    const source = seeded();
    const dir = temp();
    await exportBackup(source, dir);

    const target = new FakeProject();
    await restoreBackup(target, dir);
    expect(target.calls[0]).toBe("createUser");
    expect(target.calls.indexOf("upsert:user_stats")).toBeLessThan(target.calls.indexOf("insert:quiz_answer_events"));
    expect(target.calls.indexOf("insert:quiz_answer_events")).toBeLessThan(target.calls.indexOf("upsert:user_exam_attempts"));
    expect(target.calls.indexOf("upsert:user_exam_attempts")).toBeLessThan(target.calls.indexOf("upsert:user_exam_sessions"));

    const again = temp();
    await exportBackup(target, again);
    for (const name of readdirSync(dir)) {
      expect(readFileSync(path.join(again, name), "utf8")).toBe(readFileSync(path.join(dir, name), "utf8"));
    }
  });

  it("is idempotent and never deletes", async () => {
    const dir = temp();
    await exportBackup(seeded(), dir);
    const target = new FakeProject();
    target.tables.set("user_stats", [{ user_id: "extra", star_points: 1 }]);
    await restoreBackup(target, dir);
    const first = JSON.stringify([...target.tables.entries()]);
    target.calls = [];
    await restoreBackup(target, dir);
    expect(target.calls).toEqual([]);
    expect(JSON.stringify([...target.tables.entries()])).toBe(first);
    expect(target.tables.get("user_stats")).toHaveLength(3);
    expect(target.tables.get("quiz_answer_events")).toHaveLength(2);
    expect(target.users).toHaveLength(2);
  });

  it("rewrites only rows that differ from the project", async () => {
    const dir = temp();
    await exportBackup(seeded(), dir);
    const target = new FakeProject();
    await restoreBackup(target, dir);
    target.tables.set("user_stats", [{ user_id: "u1", star_points: 99 }, { user_id: "u2", star_points: 5 }]);
    target.calls = [];
    await restoreBackup(target, dir);
    expect(target.calls).toEqual(["upsert:user_stats"]);
    expect(target.tables.get("user_stats")).toContainEqual({ user_id: "u1", star_points: 3 });
  });

  it("rejects a file that does not match the manifest before writing anything", async () => {
    const dir = temp();
    await exportBackup(seeded(), dir);
    writeFileSync(path.join(dir, "user_stats.json"), "[]\n");
    const target = new FakeProject();
    await expect(restoreBackup(target, dir)).rejects.toThrow(/manifest/);
    expect(target.calls).toEqual([]);
  });

  it("rejects a file that is not a list", async () => {
    const dir = temp();
    await exportBackup(seeded(), dir);
    writeFileSync(path.join(dir, "user_stats.json"), "{}\n");
    await expect(restoreBackup(new FakeProject(), dir)).rejects.toThrow(/list of rows/);
  });
});

function run(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], { cwd, encoding: "utf8" }).trim();
}

function backupRepo(): string {
  const repo = temp();
  run(repo, "init", "-q", "-b", "main");
  return repo;
}

async function exportOf(project: FakeProject): Promise<string> {
  const dir = temp();
  await exportBackup(project, dir);
  return dir;
}

describe("retention", () => {
  const day = 24 * 60 * 60 * 1000;

  it("commits the first export into an empty repository with a counts-only message", async () => {
    const repo = backupRepo();
    expect(historyIsStale(repo, new Date())).toBe(false);
    expect(publishBackup(repo, await exportOf(seeded()))).toBe("committed");
    expect(run(repo, "log", "-1", "--format=%s")).toBe("Backup: 8 rows in 17 tables");
  });

  it("does not commit when nothing changed", async () => {
    const repo = backupRepo();
    const exported = await exportOf(seeded());
    publishBackup(repo, exported);
    expect(publishBackup(repo, exported)).toBe("unchanged");
    expect(run(repo, "rev-list", "--count", "HEAD")).toBe("1");
  });

  it("removes files that are no longer exported and keeps non-data files", async () => {
    const repo = backupRepo();
    writeFileSync(path.join(repo, "stale.json"), "[]");
    writeFileSync(path.join(repo, "README.txt"), "keep");
    publishBackup(repo, await exportOf(seeded()));
    expect(readdirSync(repo)).toContain("README.txt");
    expect(readdirSync(repo)).not.toContain("stale.json");
  });

  it("keeps history inside the window and resets it to one orphan commit after 29 days", async () => {
    const repo = backupRepo();
    const project = seeded();
    publishBackup(repo, await exportOf(project));
    project.users = project.users.filter((user) => user.id !== "u2");
    project.tables.set("user_stats", [{ user_id: "u1", star_points: 3 }]);
    expect(publishBackup(repo, await exportOf(project), new Date(Date.now() + 28 * day))).toBe("committed");
    expect(run(repo, "rev-list", "--count", "HEAD")).toBe("2");

    const result = publishBackup(repo, await exportOf(project), new Date(Date.now() + 30 * day));
    expect(result).toBe("reset");
    expect(run(repo, "rev-list", "--count", "HEAD")).toBe("1");
    expect(run(repo, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    expect(run(repo, "log", "-1", "--format=%s")).toBe("Backup: 6 rows in 17 tables (history reset)");
    const everything = run(repo, "log", "--all", "-p");
    expect(everything).not.toContain("b@example.test");
  });

  it("requires an export with a manifest", () => {
    expect(() => publishBackup(backupRepo(), temp())).toThrow(/manifest/);
    mkdirSync(path.join(temp(), "x"));
  });
});

describe("rehearsal safeguards", () => {
  it("only runs against a local database", async () => {
    const { assertLocal, migrationSql } = await import("../backup-rehearsal");
    expect(() => assertLocal(undefined)).toThrow(/required/);
    expect(() => assertLocal("postgresql://db.example.supabase.co/postgres")).toThrow(/local/);
    expect(assertLocal("postgresql://postgres@127.0.0.1:5432/postgres")).toContain("127.0.0.1");
    expect(migrationSql("A\nCREATE EXTENSION IF NOT EXISTS pg_cron;\nB")).toBe("A\n\nB");
  });

  it("requires Supabase credentials", async () => {
    const { supabaseClient } = await import("../backup/clients");
    expect(() => supabaseClient(undefined, undefined)).toThrow(/required/);
    expect(supabaseClient("https://x.example.test", "key")).toHaveProperty("readPage");
  });
});
