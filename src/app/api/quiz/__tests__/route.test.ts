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
}: {
  authenticated?: boolean;
  result?: Record<string, unknown> | null;
  error?: { message: string } | null;
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: USER_ID } : null },
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: result, error }),
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
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([
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
    ["question_not_found", 404, heMessages.Api.questionNotFound],
    ["idempotency_key_conflict", 409, heMessages.Api.invalidParams],
    ["topic_question_mismatch", 400, heMessages.Api.invalidParams],
  ])("maps %s to status %i", async (message, status, localizedError) => {
    const client = buildClient({ result: null, error: { message } });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: localizedError });
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
    });
  });

  it("returns 500 when the transactional submission fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = buildClient({
      result: null,
      error: { message: "submission failed" },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const response = await POST(makeRequest(defaultBody));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: heMessages.Api.answerSaveFailed,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[quiz] transactional submission failed:",
      expect.objectContaining({ message: "submission failed" })
    );
    errorSpy.mockRestore();
  });
});
