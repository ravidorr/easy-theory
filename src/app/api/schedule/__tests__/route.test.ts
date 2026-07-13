import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "../route";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const USER_ID = "user-uuid";

function makePutRequest(body: object) {
  return new Request("http://localhost/api/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawPutRequest(body: string) {
  return new Request("http://localhost/api/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function chain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const m = {} as Record<string, unknown>;
  for (const k of ["select", "eq", "order", "limit"]) {
    m[k] = vi.fn().mockReturnValue(m);
  }
  m.then = (onFulfilled: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return m;
}

function makeClient({
  user = { id: USER_ID } as { id: string } | null,
  schedule = [] as unknown[],
  rpcError = false,
} = {}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation(() => chain(schedule)),
    rpc: vi.fn().mockResolvedValue({ error: rpcError ? { message: "rpc err" } : null }),
  };
}

describe("GET /api/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the user schedule array", async () => {
    const schedule = [{ id: "s1", day_of_week: 0, start_time: "08:00" }];
    mockCreateClient.mockResolvedValue(makeClient({ schedule }) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(schedule);
  });

  it("returns an empty array when the query yields null data", async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ schedule: null as unknown as unknown[] }) as never
    );
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("PUT /api/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await PUT(makePutRequest({ days: [0], start_time: "08:00" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await PUT(makePutRequest({ days: [0], start_time: "08:00" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for a malformed JSON body", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makeRawPutRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when days is missing", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makePutRequest({ start_time: "08:00" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when start_time is missing", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makePutRequest({ days: [0] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid day values (out of 0-6 range)", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makePutRequest({ days: [0, 7], start_time: "08:00" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid time format", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makePutRequest({ days: [0], start_time: "8:00" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when the replace RPC fails", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ rpcError: true }) as never);
    const res = await PUT(makePutRequest({ days: [0], start_time: "08:00" }));
    expect(res.status).toBe(500);
  });

  it("succeeds when duration_minutes and notify are omitted, using defaults", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await PUT(makePutRequest({ days: [1], start_time: "09:00" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith("replace_user_schedule", {
      p_days: [1],
      p_start_time: "09:00",
      p_duration_minutes: 45,
      p_notify: true,
    });
  });

  it("succeeds with valid days and time, returns { ok: true }", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await PUT(makePutRequest({ days: [0, 3, 5], start_time: "08:00", duration_minutes: 30, notify: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith("replace_user_schedule", {
      p_days: [0, 3, 5],
      p_start_time: "08:00",
      p_duration_minutes: 30,
      p_notify: false,
    });
  });

  it("succeeds with empty days array (clears schedule)", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await PUT(makePutRequest({ days: [], start_time: "08:00" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith(
      "replace_user_schedule",
      expect.objectContaining({ p_days: [] })
    );
  });
});
