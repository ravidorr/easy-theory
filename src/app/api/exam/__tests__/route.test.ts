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
// Valid UUIDs for question ids (the route filters non-UUID ids out).
const QID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function makeRequest(body: object | string) {
  return new Request("http://localhost/api/exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeClient({
  user = { id: USER_ID } as { id: string } | null,
  questions = [] as { id: string; correct_option: string }[],
  insertError = false,
  medalSlug = null as string | null,
  medalError = null as { message: string } | null,
  finalizeData = null as Record<string, unknown> | null,
  finalizeError = null as { message: string } | null,
} = {}) {
  // Chainable mock that is also directly awaitable.
  function chain(data: unknown) {
    const result = { data, error: null };
    const m = {} as Record<string, unknown>;
    for (const k of ["select", "eq", "order", "limit", "in"]) {
      m[k] = vi.fn().mockReturnValue(m);
    }
    m.then = (onFulfilled: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(onFulfilled);
    return m;
  }

  const insert = vi.fn().mockResolvedValue({
    error: insertError ? { message: "err" } : null,
  });

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "questions") return chain(questions);
        if (table === "user_exam_attempts") return { insert };
        return chain(null);
      }),
      rpc: vi.fn().mockImplementation((name: string) => Promise.resolve(
        name === "finalize_exam_session"
          ? { data: finalizeData, error: finalizeError }
          : { data: medalSlug, error: medalError }
      )),
    },
    insert,
  };
}

describe("POST /api/exam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockCreateAdminClient.mockReturnValue(makeClient().client as never);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ user: null }).client as never);
    const res = await POST(makeRequest({ answers: [] }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCreateClient.mockResolvedValue(makeClient().client as never);
    mockCheckRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest({ answers: [] }));
    expect(res.status).toBe(429);
  });

  it("returns 400 on malformed JSON", async () => {
    mockCreateClient.mockResolvedValue(makeClient().client as never);
    const res = await POST(makeRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on non-object JSON body", async () => {
    mockCreateClient.mockResolvedValue(makeClient().client as never);
    const res = await POST(makeRequest("[1, 2]"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answers is not an array", async () => {
    mockCreateClient.mockResolvedValue(makeClient().client as never);
    const res = await POST(makeRequest({ answers: "nope" }));
    expect(res.status).toBe(400);
  });

  it.each([
    ["exam_session_not_found", 404],
    ["database unavailable", 500],
  ])("returns %i when session finalization fails with %s", async (message, status) => {
    const { client } = makeClient({ finalizeError: { message } });
    mockCreateClient.mockResolvedValue(client as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest({ session_id: QID(1) }));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: expect.any(String) });
    expect(client.rpc).toHaveBeenCalledWith("finalize_exam_session", { p_session_id: QID(1) });
    errorSpy.mockRestore();
  });

  it("returns a finalized failing session without attempting an achievement award", async () => {
    const { client } = makeClient({ finalizeData: { passed: false, score: 23, total: 30 } });
    const { client: adminClient } = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(adminClient as never);

    const res = await POST(makeRequest({ session_id: QID(2) }));

    expect(await res.json()).toEqual({ passed: false, score: 23, total: 30 });
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it("adds a newly earned medal to a finalized passing session", async () => {
    const { client: sessionClient } = makeClient({ finalizeData: { passed: true, score: 26, total: 30 } });
    const { client: adminClient } = makeClient({ medalSlug: "exam-pass" });
    mockCreateClient.mockResolvedValue(sessionClient as never);
    mockCreateAdminClient.mockReturnValue(adminClient as never);

    const res = await POST(makeRequest({ session_id: QID(3) }));

    expect(await res.json()).toEqual({ passed: true, score: 26, total: 30, medals_earned: ["exam-pass"] });
    expect(adminClient.rpc).toHaveBeenCalledWith("award_exam_pass_medal", { p_user_id: USER_ID });
  });

  it("returns an unchanged finalized passing session when the medal was already earned", async () => {
    const { client: sessionClient } = makeClient({ finalizeData: { passed: true, score: 26 } });
    const { client: adminClient } = makeClient();
    mockCreateClient.mockResolvedValue(sessionClient as never);
    mockCreateAdminClient.mockReturnValue(adminClient as never);

    const res = await POST(makeRequest({ session_id: QID(33) }));

    expect(await res.json()).toEqual({ passed: true, score: 26 });
  });

  it("keeps a finalized passing session successful when its medal award fails", async () => {
    const { client: sessionClient } = makeClient({ finalizeData: { passed: true, score: 26 } });
    const { client: adminClient } = makeClient({ medalError: { message: "award failed" } });
    mockCreateClient.mockResolvedValue(sessionClient as never);
    mockCreateAdminClient.mockReturnValue(adminClient as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest({ session_id: QID(4) }));

    expect(await res.json()).toEqual({ passed: true, score: 26 });
    errorSpy.mockRestore();
  });

  it("returns 400 when more answers than exam questions", async () => {
    mockCreateClient.mockResolvedValue(makeClient().client as never);
    const answers = Array.from({ length: 31 }, (_, i) => ({
      question_id: QID(i),
      selected_option: "a",
    }));
    const res = await POST(makeRequest({ answers }));
    expect(res.status).toBe(400);
  });

  it("filters out invalid answer entries instead of failing", async () => {
    const { client, insert } = makeClient({
      questions: [{ id: QID(1), correct_option: "a" }],
    });
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);
    const res = await POST(
      makeRequest({
        answers: [
          { question_id: QID(1), selected_option: "a" },
          { question_id: "not-a-uuid", selected_option: "a" },
          { question_id: QID(2), selected_option: "z" },
          null,
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(insert).toHaveBeenCalled();
  });

  it("builds topic breakdown from server-fetched question topics", async () => {
    const { client } = makeClient({
      questions: [
        { id: QID(1), correct_option: "a", topic_id: "signs" },
        { id: QID(2), correct_option: "b", topic_id: "signs" },
        { id: QID(3), correct_option: "a", topic_id: "laws" },
      ] as never,
    });
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);

    const res = await POST(makeRequest({ answers: [
      { question_id: QID(1), selected_option: "a" },
      { question_id: QID(2), selected_option: "a" },
      { question_id: QID(3), selected_option: "a" },
    ] }));

    expect((await res.json()).topic_breakdown).toEqual({
      signs: { correct: 1, total: 2 },
      laws: { correct: 1, total: 1 },
    });
  });

  it("scores valid answers safely when the question lookup returns no rows", async () => {
    const { client } = makeClient({ questions: null as never });
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);

    const res = await POST(makeRequest({ answers: [{ question_id: QID(7), selected_option: "a" }] }));

    expect(await res.json()).toMatchObject({ score: 0, topic_breakdown: {} });
  });

  it("scores server-side and returns pass at the 26 boundary", async () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({
      id: QID(i),
      correct_option: "a",
    }));
    const { client } = makeClient({ questions });
    mockCreateClient.mockResolvedValue(client as never);
    // 26 correct, 4 wrong.
    const answers = questions.map((q, i) => ({
      question_id: q.id,
      selected_option: i < 26 ? "a" : "b",
    }));
    const res = await POST(makeRequest({ answers, duration_seconds: 1830 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ score: 26, total: 30, passed: true, pass_mark: 26 });
    expect(body.results).toHaveLength(30);
  });

  it("returns fail at 25 correct", async () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({
      id: QID(i),
      correct_option: "a",
    }));
    const { client } = makeClient({ questions });
    mockCreateClient.mockResolvedValue(client as never);
    const answers = questions.map((q, i) => ({
      question_id: q.id,
      selected_option: i < 25 ? "a" : "b",
    }));
    const res = await POST(makeRequest({ answers }));
    const body = await res.json();
    expect(body).toMatchObject({ score: 25, passed: false });
  });

  it("returns exam-pass only when the protected RPC awards it", async () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({ id: QID(i), correct_option: "a" }));
    const { client } = makeClient({ questions, medalSlug: "exam-pass" });
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);

    const res = await POST(makeRequest({ answers: questions.map((q) => ({ question_id: q.id, selected_option: "a" })) }));

    expect(await res.json()).toMatchObject({ passed: true, medals_earned: ["exam-pass"] });
    expect(client.rpc).toHaveBeenCalledWith("award_exam_pass_medal", { p_user_id: USER_ID });
  });

  it("does not return exam-pass for a repeated pass", async () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({ id: QID(i), correct_option: "a" }));
    const { client } = makeClient({ questions });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await POST(makeRequest({ answers: questions.map((q) => ({ question_id: q.id, selected_option: "a" })) }));

    expect(await res.json()).not.toHaveProperty("medals_earned");
  });

  it("keeps a saved passing attempt successful when medal persistence fails", async () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({ id: QID(i), correct_option: "a" }));
    const { client } = makeClient({ questions, medalError: { message: "boom" } });
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest({ answers: questions.map((q) => ({ question_id: q.id, selected_option: "a" })) }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ passed: true });
    expect(errorSpy).toHaveBeenCalledWith(
      "[exam] achievement persistence failed:",
      expect.objectContaining({ message: "boom" })
    );
    errorSpy.mockRestore();
  });

  it("treats an empty submission as a failed exam (auto-submit at timeout)", async () => {
    const { client, insert } = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);
    const res = await POST(makeRequest({ answers: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ score: 0, total: 30, passed: false });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, score: 0, passed: false })
    );
  });

  it("persists the attempt with rounded duration and per-question results", async () => {
    const { client, insert } = makeClient({
      questions: [{ id: QID(1), correct_option: "b" }],
    });
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);
    await POST(
      makeRequest({
        answers: [{ question_id: QID(1), selected_option: "b" }],
        duration_seconds: 100.6,
      })
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 1,
        duration_seconds: 101,
        answers: [
          {
            question_id: QID(1),
            selected_option: "b",
            correct_option: "b",
            is_correct: true,
          },
        ],
      })
    );
  });

  it("stores null duration when duration_seconds is invalid", async () => {
    const { client, insert } = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);
    await POST(makeRequest({ answers: [], duration_seconds: "abc" }));
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ duration_seconds: null })
    );
  });

  it("rounds a negative duration up to zero", async () => {
    const { client, insert } = makeClient();
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);
    await POST(makeRequest({ answers: [], duration_seconds: -1.4 }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ duration_seconds: 0 }));
  });

  it("returns 500 when the attempt insert fails", async () => {
    const { client } = makeClient({ insertError: true });
    mockCreateClient.mockResolvedValue(client as never);
    mockCreateAdminClient.mockReturnValue(client as never);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest({ answers: [] }));
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
