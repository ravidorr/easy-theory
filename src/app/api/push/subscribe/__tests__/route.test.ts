import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, DELETE } from "../route";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const USER_ID = "user-uuid";

const validBody = {
  endpoint: "https://push.example.com/sub",
  keys: { auth: "auth-key", p256dh: "p256dh-key" },
};

function makePostRequest(body: object) {
  return new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawPostRequest(body: string) {
  return new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function makeDeleteRequest() {
  return new Request("http://localhost/api/push/subscribe", { method: "DELETE" });
}

function chain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const m = {} as Record<string, unknown>;
  for (const k of ["select", "eq", "delete"]) {
    m[k] = vi.fn().mockReturnValue(m);
  }
  m.upsert = vi.fn().mockResolvedValue(result);
  m.then = (onFulfilled: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return m;
}

function makeClient({
  user = { id: USER_ID } as { id: string } | null,
  upsertError = false,
  deleteError = false,
} = {}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi
      .fn()
      .mockReturnValue(
        chain(null, upsertError || deleteError ? { message: "db error" } : null)
      ),
  };
}

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 for a malformed JSON body", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makeRawPostRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when endpoint is missing", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makePostRequest({ keys: { auth: "a", p256dh: "b" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when auth key is missing", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makePostRequest({ endpoint: "https://x.com", keys: { p256dh: "b" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when p256dh key is missing", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makePostRequest({ endpoint: "https://x.com", keys: { auth: "a" } }));
    expect(res.status).toBe(400);
  });

  it("returns 500 with a generic message when upsert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(makeClient({ upsertError: true }) as never);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("db error");
    consoleSpy.mockRestore();
  });

  it("returns { ok: true } on successful upsert", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("DELETE /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await DELETE(makeDeleteRequest());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await DELETE(makeDeleteRequest());
    expect(res.status).toBe(429);
  });

  it("returns 500 when the delete fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(makeClient({ deleteError: true }) as never);
    const res = await DELETE(makeDeleteRequest());
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it("deletes all subscriptions and returns { ok: true }", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await DELETE(makeDeleteRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
