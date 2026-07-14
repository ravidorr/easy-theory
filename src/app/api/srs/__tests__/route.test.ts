import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import heMessages from "../../../../../messages/he.json";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const USER_ID = "user-uuid";
const SIGN_ID = "33333333-3333-4333-8333-333333333333";

function makeRequest(body: object) {
  return new Request("http://localhost/api/srs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Existing = { ease: number; interval_days: number; repetitions: number } | null;

function makeClient({
  user = { id: USER_ID } as { id: string } | null,
  existing = null as Existing,
  selectError = null as { message: string } | null,
  upsertError = null as { message: string; code?: string } | null,
} = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const chain = {} as Record<string, unknown>;
  for (const k of ["select", "eq"]) {
    chain[k] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: selectError ? null : existing,
    error: selectError,
  });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockImplementation(() => ({ ...chain, upsert })),
    upsert,
  };
}

describe("POST /api/srs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: true }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: true }));
    expect(res.status).toBe(429);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      `srs:${USER_ID}`,
      60,
      60
    );
  });

  it("returns 400 for a malformed JSON body", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await POST(
      new Request("http://localhost/api/srs", { method: "POST", body: "{not json" })
    );
    expect(res.status).toBe(400);
  });

  it.each([
    [{ knew: true }, "missing sign_id"],
    [{ sign_id: "not-a-uuid", knew: true }, "malformed sign_id"],
    [{ sign_id: SIGN_ID }, "missing knew"],
    [{ sign_id: SIGN_ID, knew: "yes" }, "non-boolean knew"],
  ])("returns 400 for %s (%s)", async (body) => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(client.upsert).not.toHaveBeenCalled();
  });

  it("creates a new card from the initial SM-2 state on first grade", async () => {
    const client = makeClient({ existing: null });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: true }));

    expect(res.status).toBe(200);
    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        sign_id: SIGN_ID,
        ease: 2.5,
        interval_days: 1,
        repetitions: 1,
      }),
      { onConflict: "user_id,sign_id" }
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.due_at).toBe(client.upsert.mock.calls[0][0].due_at);
  });

  it("advances an existing card on a pass", async () => {
    const client = makeClient({ existing: { ease: 2.5, interval_days: 1, repetitions: 1 } });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: true }));

    expect(res.status).toBe(200);
    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ease: 2.5, interval_days: 6, repetitions: 2 }),
      { onConflict: "user_id,sign_id" }
    );
  });

  it("resets an existing card and shrinks ease on a fail", async () => {
    const client = makeClient({ existing: { ease: 2.5, interval_days: 6, repetitions: 2 } });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: false }));

    expect(res.status).toBe(200);
    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ease: 2.3, interval_days: 0, repetitions: 0 }),
      { onConflict: "user_id,sign_id" }
    );
  });

  it("returns 400 for an unknown sign (foreign key violation)", async () => {
    const client = makeClient({ upsertError: { message: "fk", code: "23503" } });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: true }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: heMessages.Api.invalidParams });
  });

  it("returns 500 when the upsert fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = makeClient({ upsertError: { message: "boom" } });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: true }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: heMessages.Api.srsSaveFailed });
    errorSpy.mockRestore();
  });

  it("returns 500 when the existing-card select fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = makeClient({ selectError: { message: "boom" } });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await POST(makeRequest({ sign_id: SIGN_ID, knew: true }));

    expect(res.status).toBe(500);
    expect(client.upsert).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
