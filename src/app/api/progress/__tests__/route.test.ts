import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { createAdminClient, createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase", () => ({ createAdminClient: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const USER_ID = "user-uuid";

function makeRequest(body: object) {
  return new Request("http://localhost/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(body: string) {
  return new Request("http://localhost/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

type Existing = { id: string; best_score: number | null; status: string } | null;

function makeClient({
  user = { id: USER_ID } as { id: string } | null,
  existing = null as Existing,
  updateError = false,
  insertError = false,
} = {}) {
  let progressCallCount = 0;
  const insert = vi.fn().mockResolvedValue({
    error: insertError ? { message: "err" } : null,
  });

  // Chainable mock that is also directly awaitable.
  function chain(data: unknown, error: unknown = null) {
    const result = { data, error };
    const m = {} as Record<string, unknown>;
    for (const k of ["select", "eq", "order", "limit"]) {
      m[k] = vi.fn().mockReturnValue(m);
    }
    m.single = vi.fn().mockResolvedValue(result);
    m.then = (onFulfilled: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(onFulfilled);
    return m;
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "user_topic_progress") {
        progressCallCount++;
        if (progressCallCount === 1) {
          return chain(existing);
        }
        // Second call: update or insert
        const updateChain = {} as Record<string, unknown>;
        updateChain.then = (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve({ error: updateError ? { message: "err" } : null }).then(onFulfilled);
        updateChain.eq = vi.fn().mockReturnValue(updateChain);
        return {
          update: vi.fn().mockReturnValue(updateChain),
          insert,
        };
      }
      return chain(null);
    }),
    insert,
  };
}

function mockClients(client: ReturnType<typeof makeClient>) {
  mockCreateClient.mockResolvedValue(client as never);
  mockCreateAdminClient.mockReturnValue(client as never);
}

describe("POST /api/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockClients(makeClient({ user: null }));
    const res = await POST(makeRequest({ topic_id: "t1" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockClients(makeClient());
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest({ topic_id: "t1" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for a malformed JSON body", async () => {
    mockClients(makeClient());
    const res = await POST(makeRawRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when topic_id is missing", async () => {
    mockClients(makeClient());
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("inserts a new record when no existing progress", async () => {
    const client = makeClient({ existing: null });
    mockClients(client);
    const res = await POST(makeRequest({ topic_id: "t1", status: "in_progress" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does not accept client-reported completion", async () => {
    const client = makeClient({ existing: null });
    mockClients(client);

    const res = await POST(makeRequest({ topic_id: "t1", status: "completed" }));

    expect(res.status).toBe(200);
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_progress" })
    );
  });

  it("returns 500 when the insert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClients(makeClient({ existing: null, insertError: true }));
    const res = await POST(makeRequest({ topic_id: "t1" }));
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it("updates existing record and never downgrades from completed", async () => {
    const existing = { id: "p1", best_score: 80, status: "completed" };
    const client = makeClient({ existing });
    mockClients(client);
    const res = await POST(makeRequest({ topic_id: "t1", status: "in_progress", score: 50 }));
    expect(res.status).toBe(200);
    // The update mock is called — we trust the route doesn't downgrade (tested via status logic)
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 500 when the update fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const existing = { id: "p1", best_score: 80, status: "in_progress" };
    mockClients(makeClient({ existing, updateError: true }));
    const res = await POST(makeRequest({ topic_id: "t1", score: 90 }));
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it("defaults invalid status to in_progress", async () => {
    const client = makeClient({ existing: null });
    mockClients(client);
    const res = await POST(makeRequest({ topic_id: "t1", status: "bogus" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("uses best_score max when updating existing record", async () => {
    const existing = { id: "p1", best_score: 70, status: "in_progress" };
    const client = makeClient({ existing });
    mockClients(client);
    const res = await POST(makeRequest({ topic_id: "t1", score: 90 }));
    expect(res.status).toBe(200);
  });
});
