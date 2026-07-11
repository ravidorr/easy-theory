import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "../route";
import { createClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const USER_ID = "user-uuid";

function makeGetRequest() {
  return new Request("http://localhost/api/schedule");
}

function makePutRequest(body: object) {
  return new Request("http://localhost/api/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const m = {} as Record<string, unknown>;
  for (const k of ["select", "eq", "order", "delete", "limit"]) {
    m[k] = vi.fn().mockReturnValue(m);
  }
  m.insert = vi.fn().mockResolvedValue({ data: null, error: null });
  m.then = (onFulfilled: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return m;
}

function makeClient({
  user = { id: USER_ID } as { id: string } | null,
  schedule = [] as unknown[],
  deleteError = false,
  insertError = false,
} = {}) {
  let scheduleCalled = 0;
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "user_schedule") {
        scheduleCalled++;
        if (scheduleCalled === 1) {
          // GET fetch OR PUT delete
          return chain(schedule, deleteError ? { message: "delete err" } : null);
        }
        // PUT insert (second call)
        return { insert: vi.fn().mockResolvedValue({ error: insertError ? { message: "insert err" } : null }) };
      }
      return chain(null);
    }),
  };
}

describe("GET /api/schedule", () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
});

describe("PUT /api/schedule", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await PUT(makePutRequest({ days: [0], start_time: "08:00" }));
    expect(res.status).toBe(401);
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

  it("returns 500 when delete fails", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ deleteError: true }) as never);
    const res = await PUT(makePutRequest({ days: [0], start_time: "08:00" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 when insert fails", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ insertError: true }) as never);
    const res = await PUT(makePutRequest({ days: [0], start_time: "08:00" }));
    expect(res.status).toBe(500);
  });

  it("succeeds when duration_minutes and notify are omitted, using defaults", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makePutRequest({ days: [1], start_time: "09:00" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("succeeds with valid days and time, returns { ok: true }", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makePutRequest({ days: [0, 3, 5], start_time: "08:00", duration_minutes: 30, notify: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("succeeds with empty days array (clears schedule)", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makePutRequest({ days: [], start_time: "08:00" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
