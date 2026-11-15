// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_TABLES,
  BackupError,
  OMITTED_TABLES,
  USERS_FILE,
  type BackupClient,
  type Row,
} from "../backup/tables";
import {
  danglingReferences,
  exportBackup,
  main as exportMain,
  PAGE_SIZE,
  safeMessage,
} from "../backup-export";
import { historyIsStale, publishBackup, verifyExport } from "../backup-publish";
import { assertLocal } from "../backup-rehearsal";

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "backup-hardening-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.doUnmock("@supabase/supabase-js");
  process.exitCode = 0;
});

function clientOf(
  tables: Record<string, Row[]>,
  users: Row[],
  counts: (table: string, call: number) => number = (table) => (tables[table] ?? []).length
): BackupClient {
  const calls = new Map<string, number>();
  return {
    async readPage(table, _key, offset, limit) {
      const call = (calls.get(table) ?? 0) + 1;
      calls.set(table, call);
      return { rows: (tables[table] ?? []).slice(offset, offset + limit), count: counts(table, call) };
    },
    async listUsers(page, perPage) {
      return { users: users.slice((page - 1) * perPage, page * perPage), total: users.length };
    },
  };
}

describe("export consistency", () => {
  it("rejects a table whose total changes between pages", async () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => ({ user_id: `u${index}` }));
    const users = rows.map((row) => ({ id: row.user_id }));
    const client = clientOf({ user_stats: rows }, users, (table, call) => (table === "user_stats" ? rows.length - (call % 2) : 0));
    await expect(exportBackup(client, temp())).rejects.toThrow(/user_stats was inconsistent/);
  });

  it("rejects rows that reference a missing user, topic, question or array member", async () => {
    const files = (extra: Record<string, Row[]>) =>
      new Map<string, Row[]>([[USERS_FILE, [{ id: "u1" }]], ["questions", [{ id: "q1" }]], ...Object.entries(extra)]);
    expect(danglingReferences(files({ user_stats: [{ user_id: "u1" }] }))).toBe(0);
    expect(danglingReferences(files({ user_stats: [{ user_id: "ghost" }] }))).toBe(1);
    expect(danglingReferences(files({ user_exam_sessions: [{ user_id: "u1", question_ids: ["q1", "gone"] }] }))).toBe(1);
    expect(danglingReferences(files({ user_stats: [{ user_id: null }] }))).toBe(0);
  });

  it("retries when a user signs up between the reads, and fails if it never settles", async () => {
    const tables = { user_stats: [{ user_id: "u1" }, { user_id: "u2" }] } as Record<string, Row[]>;
    const users = [{ id: "u1" }];
    let listCalls = 0;
    const settling: BackupClient = {
      ...clientOf(tables, users),
      async listUsers() {
        listCalls += 1;
        return listCalls === 1 ? { users: [{ id: "u1" }], total: 1 } : { users: [{ id: "u1" }, { id: "u2" }], total: 2 };
      },
    };
    await expect(exportBackup(settling, temp())).resolves.toBeDefined();
    await expect(exportBackup(clientOf(tables, users), temp())).rejects.toThrow(/missing ids/);
  });
});

describe("publish verification", () => {
  async function validExport(): Promise<string> {
    const dir = temp();
    await exportBackup(clientOf({}, [{ id: "u1" }]), dir);
    return dir;
  }

  it("refuses an export with a missing or short file", async () => {
    const dir = await validExport();
    const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
    expect(() => verifyExport(dir, manifest)).not.toThrow();
    writeFileSync(path.join(dir, "user_stats.json"), '[{"user_id":"x"}]\n');
    expect(() => verifyExport(dir, manifest)).toThrow(/does not match/);
    writeFileSync(path.join(dir, "user_stats.json"), "{}\n");
    expect(() => verifyExport(dir, manifest)).toThrow(/does not match/);
    rmSync(path.join(dir, "user_stats.json"));
    expect(() => verifyExport(dir, manifest)).toThrow(/missing user_stats/);
  });

  it("does not publish a short export", async () => {
    const dir = await validExport();
    rmSync(path.join(dir, "topics.json"));
    const repo = temp();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
    expect(() => publishBackup(repo, dir)).toThrow(/missing topics/);
    expect(readdirSync(repo).filter((name) => name.endsWith(".json"))).toEqual([]);
  });
});

describe("history age", () => {
  it("fails loudly outside a git repository instead of looking fresh", () => {
    expect(() => historyIsStale(temp(), new Date())).toThrow();
  });

  it("treats an empty repository as fresh and a boundary age correctly", () => {
    const repo = temp();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
    expect(historyIsStale(repo, new Date())).toBe(false);
    const env = { ...process.env, GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z", GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z" };
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", "commit", "-q", "--allow-empty", "-m", "x"], { cwd: repo, env });
    const day = 24 * 60 * 60 * 1000;
    const first = Date.parse("2026-01-01T00:00:00Z");
    expect(historyIsStale(repo, new Date(first + 29 * day))).toBe(false);
    expect(historyIsStale(repo, new Date(first + 29 * day + 1000))).toBe(true);
  });
});

describe("error reporting and the rehearsal guard", () => {
  it("prints only messages this code wrote", () => {
    expect(safeMessage(new BackupError("read of x failed (500)"))).toBe("read of x failed (500)");
    expect(safeMessage(new Error('Key (id)=(secret) already exists'))).toBe("unexpected failure");
    expect(safeMessage("text")).toBe("unexpected failure");
  });

  it("sets a failing exit code and stays quiet about row values", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("BACKUP_DATABASE_URL", "");
    await exportMain([temp()]);
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("backup:export - "));
    vi.unstubAllEnvs();
  });

  it("refuses lookalike hosts, redirected hosts and invalid URLs", () => {
    expect(() => assertLocal("postgresql://localhost.evil.example/db")).toThrow(/local/);
    expect(() => assertLocal("postgresql://localhost@prod.example.com/db")).toThrow(/local/);
    expect(() => assertLocal("postgresql://localhost/db?host=prod.example.com")).toThrow(/local/);
    expect(() => assertLocal("not a url")).toThrow(/valid URL/);
    expect(assertLocal("postgresql://postgres@[::1]:5432/postgres")).toContain("[::1]");
  });
});

describe("table coverage", () => {
  it("accounts for every table the schema creates", () => {
    const sources = [
      readFileSync("seeds/schema.sql", "utf8"),
      ...readdirSync("seeds/migrations")
        .filter((name) => name.endsWith(".sql"))
        .map((name) => readFileSync(path.join("seeds/migrations", name), "utf8")),
    ].join("\n");
    const created = new Set(
      [...sources.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?([a-z_]+)/gi)].map((match) => match[1].toLowerCase())
    );
    const known = new Set([...BACKUP_TABLES.map((table) => table.name), ...Object.keys(OMITTED_TABLES)]);
    expect([...created].filter((name) => !known.has(name))).toEqual([]);
    expect([...known].filter((name) => !created.has(name))).toEqual([]);
  });
});

describe("Supabase client", () => {
  async function load(handlers: {
    select?: () => Promise<{ data: Row[] | null; error: { code?: string; message?: string } | null; count: number | null }>;
    admin?: Record<string, unknown>;
  }) {
    const order = vi.fn();
    const range = vi.fn(handlers.select ?? (async () => ({ data: [], error: null, count: 0 })));
    const upsert = vi.fn(async () => ({ error: null }));
    const insert = vi.fn(async () => ({ error: null }));
    const query = { order: (...args: unknown[]) => (order(...args), query), range };
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({
        from: () => ({ select: () => query, upsert, insert }),
        auth: { admin: handlers.admin ?? {} },
      }),
    }));
    vi.resetModules();
    const { supabaseClient } = await import("../backup/clients");
    return { client: supabaseClient("https://x.example.test", "key"), order, range, upsert, insert };
  }

  it("orders by every key column before paging and treats a missing count as zero", async () => {
    const { client, order, range } = await load({});
    await expect(client.readPage("user_medals", ["a", "b"], 10, 5)).resolves.toEqual({ rows: [], count: 0 });
    expect(order).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenCalledWith(10, 14);
  });

  it("reports only the code and table, never the message", async () => {
    const { client } = await load({
      select: async () => ({ data: null, error: { code: "42501", message: "Key (user_id)=(secret) leaked" }, count: null }),
    });
    const failure = await client.readPage("user_stats", ["user_id"], 0, 10).catch((error: Error) => error);
    expect((failure as Error).message).toBe("read of user_stats failed (42501)");
  });

  it("reads users with their total and rejects a response without one", async () => {
    const listUsers = vi.fn(async () => ({ data: { users: [{ id: "u1", email: "a@example.test", extra: 1 }], total: 1 }, error: null }));
    const { client } = await load({ admin: { listUsers } });
    const page = await client.listUsers(1, 1000);
    expect(page.total).toBe(1);
    expect(Object.keys(page.users[0])).not.toContain("extra");

    const missing = await load({ admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } });
    await expect(missing.client.listUsers(1, 10)).rejects.toThrow(/total is missing/);
    const broken = await load({ admin: { listUsers: async () => ({ data: null, error: { status: undefined } }) } });
    await expect(broken.client.listUsers(1, 10)).rejects.toThrow(/\(no code\)/);
  });

  it("treats a 404 as a missing user and any other error as a failure", async () => {
    const lookup = (result: unknown) => load({ admin: { getUserById: async () => result } });
    expect(await (await lookup({ data: { user: null }, error: { status: 404 } })).client.userExists("u")).toBe(false);
    expect(await (await lookup({ data: { user: { id: "u" } }, error: null })).client.userExists("u")).toBe(true);
    await expect((await lookup({ data: null, error: { status: 500 } })).client.userExists("u")).rejects.toThrow(/500/);
  });

  it("creates users with their id and maps empty values", async () => {
    const createUser = vi.fn(async () => ({ error: null }));
    const { client } = await load({ admin: { createUser } });
    await client.createUser({ id: "u1", email: null, phone: "", email_confirmed_at: null, user_metadata: null, app_metadata: null });
    expect(createUser).toHaveBeenCalledWith({
      id: "u1", email: undefined, phone: undefined, email_confirm: false, user_metadata: {}, app_metadata: {},
    });
    const failing = await load({ admin: { createUser: async () => ({ error: { status: 422 } }) } });
    await expect(failing.client.createUser({ id: "u1" })).rejects.toThrow(/422/);
  });

  it("upserts on the key columns and inserts plainly", async () => {
    const { client, upsert, insert } = await load({});
    await client.upsertRows({ name: "user_medals", key: ["user_id", "medal_slug"] }, [{ a: 1 }]);
    expect(upsert).toHaveBeenCalledWith([{ a: 1 }], { onConflict: "user_id,medal_slug" });
    await client.insertRows({ name: "quiz_answer_events", key: ["user_id"] }, [{ a: 1 }]);
    expect(insert).toHaveBeenCalledWith([{ a: 1 }]);
  });
});
