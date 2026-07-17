import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { createClient } from "@/lib/supabase";
import arMessages from "../../../../../messages/ar.json";
import heMessages from "../../../../../messages/he.json";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const TOPIC_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-uuid";
const IDEMPOTENCY_KEY = `session-uuid:${QUESTION_ID}`;
const SESSION_ID = "123e4567-e89b-42d3-a456-426614174000";

const storedResult = {
  is_correct: true,
  correct_option: "a",
  explanation_he: "הסבר",
  stars_earned: 10,
  new_total_stars: 30,
  streak_days: 3,
  medals_earned: ["streak-3"],
  topic_completed: true,
};

const defaultBody = {
  question_id: QUESTION_ID,
  selected_option: "a",
  topic_id: TOPIC_ID,
  session_id: SESSION_ID,
  idempotency_key: IDEMPOTENCY_KEY,
};

function makeRequest(body: object, cookie?: string) {
  return new Request("http://localhost:3000/api/quiz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function buildClient({
  authenticated = true,
  result = storedResult,
  error = null,
  srsExisting = null,
  srsUpsertError = null,
}: {
  authenticated?: boolean;
  result?: Record<string, unknown> | null;
  error?: { message: string } | null;
  srsExisting?: { ease: number; interval_days: number; repetitions: number } | null;
  srsUpsertError?: { message: string } | null;
} = {}) {
  const srsUpsert = vi.fn().mockResolvedValue({ error: srsUpsertError });
  const srsChain = {} as Record<string, unknown>;
  for (const k of ["select", "eq"]) {
    srsChain[k] = vi.fn().mockReturnValue(srsChain);
  }
  srsChain.maybeSingle = vi.fn().mockResolvedValue({ data: srsExisting, error: null });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: USER_ID } : null },
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: result, error }),
    from: vi.fn().mockImplementation(() => ({ ...srsChain, upsert: srsUpsert })),
    srsUpsert,
  };
}

describe("POST /api/quiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const client = buildClient({ authenticated: false });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: heMessages.Api.notAuthenticated,
      code: "NOT_AUTHENTICATED",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    const client = buildClient({
      result: null,
      error: { message: "rate_limited" },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: heMessages.Api.tooManyRequests,
      code: "RATE_LIMITED",
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "submit_quiz_answer",
      expect.any(Object)
    );
  });

  it("returns 400 for malformed JSON", async () => {
    const client = buildClient();
    mockCreateClient.mockResolvedValue(client as never);
    const request = new Request("http://localhost:3000/api/quiz", {
      method: "POST",
      body: "{not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: heMessages.Api.missingParams,
      code: "INVALID_REQUEST",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each<[Record<string, unknown>, string]>([
    [{ ...defaultBody, question_id: undefined }, "question id"],
    [{ ...defaultBody, question_id: "not-a-uuid" }, "malformed question id"],
    [{ ...defaultBody, topic_id: "not-a-uuid" }, "malformed topic id"],
    [{ ...defaultBody, selected_option: "e" }, "selected option"],
    [{ ...defaultBody, idempotency_key: undefined }, "idempotency key"],
    [{ ...defaultBody, idempotency_key: "x".repeat(201) }, "long idempotency key"],
  ])("returns 400 for an invalid %s", async (body) => {
    const client = buildClient();
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: heMessages.Api.missingParams,
      code: "INVALID_REQUEST",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("passes authenticated submission inputs to the transactional RPC", async () => {
    const client = buildClient();
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(storedResult);
    expect(client.rpc).toHaveBeenCalledWith("submit_quiz_answer", {
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_question_id: QUESTION_ID,
      p_selected_option: "a",
      p_topic_id: TOPIC_ID,
      p_session_id: SESSION_ID,
    });
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty("user_id");
  });

  it("passes null for omitted optional identifiers", async () => {
    const client = buildClient();
    mockCreateClient.mockResolvedValue(client as never);

    await POST(
      makeRequest({
        question_id: QUESTION_ID,
        selected_option: "a",
        idempotency_key: IDEMPOTENCY_KEY,
      })
    );

    expect(client.rpc).toHaveBeenCalledWith(
      "submit_quiz_answer",
      expect.objectContaining({
        p_topic_id: null,
        p_session_id: null,
      })
    );
  });

  it("coerces an invalid session id to null", async () => {
    const client = buildClient();
    mockCreateClient.mockResolvedValue(client as never);

    await POST(makeRequest({ ...defaultBody, session_id: "not-a-uuid" }));

    expect(client.rpc).toHaveBeenCalledWith(
      "submit_quiz_answer",
      expect.objectContaining({ p_session_id: null })
    );
  });

  it("returns the same stored outcome for concurrent identical submissions", async () => {
    const client = buildClient();
    mockCreateClient.mockResolvedValue(client as never);

    const [first, second] = await Promise.all([
      POST(makeRequest(defaultBody)),
      POST(makeRequest(defaultBody)),
    ]);

    expect(await first.json()).toEqual(storedResult);
    expect(await second.json()).toEqual(storedResult);
    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(client.rpc.mock.calls[0]).toEqual(client.rpc.mock.calls[1]);
  });

  it.each([
    ["not_authenticated", 401, "NOT_AUTHENTICATED", heMessages.Api.notAuthenticated],
    ["invalid_quiz_submission", 400, "INVALID_SUBMISSION", heMessages.Api.invalidParams],
    ["question_not_found", 404, "QUESTION_NOT_FOUND", heMessages.Api.questionNotFound],
    ["idempotency_key_conflict", 409, "IDEMPOTENCY_CONFLICT", heMessages.Api.invalidParams],
    ["topic_question_mismatch", 400, "TOPIC_MISMATCH", heMessages.Api.invalidParams],
    ["rate_limited", 429, "RATE_LIMITED", heMessages.Api.tooManyRequests],
  ])("maps %s to status %i with code %s", async (message, status, code, localizedError) => {
    const client = buildClient({ result: null, error: { message } });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: localizedError, code });
  });

  it("returns 503 with a correlation ref when the stored result is still in flight", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = buildClient({
      result: null,
      error: { message: "idempotency_result_missing" },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      error: heMessages.Api.answerSaveInFlight,
      code: "SUBMISSION_IN_FLIGHT",
      ref: expect.stringMatching(/^[0-9a-f]{8}$/),
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[quiz] transactional submission failed:",
      expect.objectContaining({
        ref: body.ref,
        pg: expect.objectContaining({ message: "idempotency_result_missing" }),
      })
    );
    errorSpy.mockRestore();
  });

  it("localizes transactional errors from the locale cookie", async () => {
    const client = buildClient({
      result: null,
      error: { message: "rate_limited" },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(
      makeRequest(defaultBody, "NEXT_LOCALE=ar")
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: arMessages.Api.tooManyRequests,
      code: "RATE_LIMITED",
    });
  });

  it("advances the question's SRS card after a correct answer", async () => {
    const client = buildClient({ result: { ...storedResult, is_correct: true } });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(200);
    expect(client.from).toHaveBeenCalledWith("user_srs_cards");
    expect(client.srsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        question_id: QUESTION_ID,
        ease: 2.5,
        interval_days: 1,
        repetitions: 1,
      }),
      { onConflict: "user_id,question_id" }
    );
  });

  it("resets the question's SRS card after a wrong answer", async () => {
    const client = buildClient({
      result: { ...storedResult, is_correct: false },
      srsExisting: { ease: 2.5, interval_days: 6, repetitions: 2 },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(200);
    expect(client.srsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ ease: 2.3, interval_days: 0, repetitions: 0 }),
      { onConflict: "user_id,question_id" }
    );
  });

  it("does not touch SRS state when the transactional RPC fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = buildClient({ result: null, error: { message: "rate_limited" } });
    mockCreateClient.mockResolvedValue(client as never);

    await POST(makeRequest(defaultBody));

    expect(client.from).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("still returns the quiz result when the SRS update fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = buildClient({ srsUpsertError: { message: "boom" } });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(storedResult);
    expect(errorSpy).toHaveBeenCalledWith("[quiz] SRS update failed:", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("returns 500 with a correlation ref when the transactional submission fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = buildClient({
      result: null,
      error: { message: "submission failed" },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: heMessages.Api.answerSaveFailed,
      code: "SUBMISSION_FAILED",
      ref: expect.stringMatching(/^[0-9a-f]{8}$/),
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[quiz] transactional submission failed:",
      expect.objectContaining({
        ref: body.ref,
        userId: USER_ID,
        questionId: QUESTION_ID,
        topicId: TOPIC_ID,
        sessionId: SESSION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        pg: expect.objectContaining({ message: "submission failed" }),
      })
    );
    errorSpy.mockRestore();
  });
});
