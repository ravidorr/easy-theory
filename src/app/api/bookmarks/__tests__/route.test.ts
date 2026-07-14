import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "../route";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const USER_ID = "user-uuid";
const QUESTION_ID = "11111111-2222-3333-4444-555555555555";

function makeRequest(body: object) {
  return new Request("http://localhost/api/bookmarks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(body: string) {
  return new Request("http://localhost/api/bookmarks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function makeClient({
  user = { id: USER_ID } as { id: string } | null,
  upsertError = null as { message: string; code?: string } | null,
  deleteError = null as { message: string } | null,
} = {}) {
  const upsertFn = vi.fn().mockResolvedValue({ error: upsertError });
  const eqFn = vi.fn();
  // Chainable thenable: .delete().eq(...).eq(...) resolves to { error }.
  const deleteChain: Record<string, unknown> = {
    eq: eqFn.mockImplementation(() => deleteChain),
    then: (onFulfilled: (v: { error: unknown }) => unknown) =>
      Promise.resolve({ error: deleteError }).then(onFulfilled),
  };
  const deleteFn = vi.fn().mockReturnValue(deleteChain);
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({ upsert: upsertFn, delete: deleteFn }),
    upsertFn,
    deleteFn,
    eqFn,
  };
}

describe("PUT /api/bookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: true }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: true }));
    expect(res.status).toBe(429);
  });

  it("returns 400 for a malformed JSON body", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makeRawRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when question_id is not a UUID", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makeRequest({ question_id: "not-a-uuid", bookmarked: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bookmarked is not a boolean", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: "yes" }));
    expect(res.status).toBe(400);
  });

  it("upserts the bookmark scoped to the (user, question) pair", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, bookmarked: true });
    expect(client.from).toHaveBeenCalledWith("user_question_bookmarks");
    expect(client.upsertFn).toHaveBeenCalledWith(
      { user_id: USER_ID, question_id: QUESTION_ID },
      { onConflict: "user_id,question_id", ignoreDuplicates: true }
    );
  });

  it("deletes the bookmark filtered by both user and question", async () => {
    const client = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, bookmarked: false });
    expect(client.deleteFn).toHaveBeenCalled();
    expect(client.eqFn).toHaveBeenCalledWith("user_id", USER_ID);
    expect(client.eqFn).toHaveBeenCalledWith("question_id", QUESTION_ID);
  });

  it("returns 404 when the question does not exist (FK violation)", async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ upsertError: { message: "fk violation", code: "23503" } }) as never
    );
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: true }));
    expect(res.status).toBe(404);
  });

  it("returns 500 with a generic message when the upsert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(
      makeClient({ upsertError: { message: "db error" } }) as never
    );
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: true }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("db error");
    consoleSpy.mockRestore();
  });

  it("returns 500 when the delete fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(
      makeClient({ deleteError: { message: "db error" } }) as never
    );
    const res = await PUT(makeRequest({ question_id: QUESTION_ID, bookmarked: false }));
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
