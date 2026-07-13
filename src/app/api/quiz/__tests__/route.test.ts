import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { createClient } from "@/lib/supabase";
import { checkTopicCompletion } from "@/lib/topic-completion";
import { markTopicCompleted } from "@/lib/db";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/topic-completion", () => ({ checkTopicCompletion: vi.fn() }));
vi.mock("@/lib/db", () => ({ markTopicCompleted: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCheckTopicCompletion = vi.mocked(checkTopicCompletion);
const mockMarkTopicCompleted = vi.mocked(markTopicCompleted);

const QUESTION_ID = "q-uuid";
const TOPIC_ID = "topic-uuid";
const USER_ID = "user-uuid";

function makeRequest(body: object) {
  return new Request("http://localhost:3000/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "session=abc" },
    body: JSON.stringify(body),
  });
}

const defaultBody = { question_id: QUESTION_ID, selected_option: "a", topic_id: TOPIC_ID };

type DbConfig = {
  authenticated?: boolean;
  correctOption?: string;
  alreadyAnsweredCorrectly?: boolean;
  existingProgress?: { status: string } | null;
  stats?: { star_points: number; streak_days: number; last_active_date: string | null } | null;
  updatedStats?: { star_points: number; streak_days: number } | null;
  noQuestion?: boolean;
  rateLimitPass?: boolean;
  upsertError?: boolean;
  medalInsertError?: boolean;
};

function buildDb({
  authenticated = true,
  correctOption = "a",
  alreadyAnsweredCorrectly = false,
  existingProgress = null,
  stats = { star_points: 0, streak_days: 0, last_active_date: null },
  updatedStats = { star_points: 10, streak_days: 1 },
  noQuestion = false,
  rateLimitPass = true,
  upsertError = false,
  medalInsertError = false,
}: DbConfig = {}) {
  const calls: Record<string, number> = {};
  const nc = (t: string) => {
    calls[t] = (calls[t] ?? 0) + 1;
    return calls[t];
  };

  const upsertMock = vi.fn().mockResolvedValue({
    error: upsertError ? { message: "upsert failed" } : null,
  });

  return {
    upsertMock,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: USER_ID } : null },
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: rateLimitPass }),
    from: vi.fn().mockImplementation((table: string) => {
      const n = nc(table);

      if (table === "questions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: noQuestion ? null : { correct_option: correctOption, explanation_he: null },
            error: null,
          }),
        };
      }

      if (table === "user_quiz_responses") {
        // call 1: existingCorrect check (maybeSingle); call 2: upsert
        if (n === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: alreadyAnsweredCorrectly ? { id: "existing" } : null,
              error: null,
            }),
          };
        }
        return { upsert: upsertMock };
      }

      if (table === "user_stats") {
        // call 1: get stats; call 2: insert/update; call 3: get updatedStats
        if (n === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: stats, error: null }),
            }),
          };
        }
        if (n === 2) {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedStats, error: null }),
          }),
        };
      }

      if (table === "user_medals") {
        return {
          insert: vi.fn().mockResolvedValue({
            error: medalInsertError ? { message: "insert failed" } : null,
          }),
        };
      }

      if (table === "user_topic_progress") {
        // call 1: get progress; call 2: insert or update
        if (n === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: existingProgress, error: null }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
  };
}

describe("POST /api/quiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkTopicCompleted.mockResolvedValue(undefined);
    mockCheckTopicCompletion.mockResolvedValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(buildDb({ authenticated: false }) as never);
    const res = await POST(makeRequest(defaultBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when question_id is missing", async () => {
    mockCreateClient.mockResolvedValue(buildDb() as never);
    const res = await POST(makeRequest({ selected_option: "a", topic_id: TOPIC_ID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body", async () => {
    mockCreateClient.mockResolvedValue(buildDb() as never);
    const res = await POST(
      new Request("http://localhost:3000/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when question does not exist", async () => {
    mockCreateClient.mockResolvedValue(buildDb({ noQuestion: true }) as never);
    const res = await POST(makeRequest(defaultBody));
    expect(res.status).toBe(404);
  });

  it("returns is_correct: false on wrong answer and does not call completion check", async () => {
    mockCreateClient.mockResolvedValue(buildDb({ correctOption: "b" }) as never);
    const res = await POST(makeRequest({ ...defaultBody, selected_option: "a" }));
    const body = await res.json();
    expect(body.is_correct).toBe(false);
    expect(body.stars_earned).toBe(0);
    expect(body.topic_completed).toBe(false);
    expect(mockCheckTopicCompletion).not.toHaveBeenCalled();
  });

  it("awards stars_earned: 0 when the same question was already answered correctly", async () => {
    mockCreateClient.mockResolvedValue(buildDb({ alreadyAnsweredCorrectly: true }) as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.is_correct).toBe(true);
    expect(body.stars_earned).toBe(0);
  });

  it("returns topic_completed: false and does not mark topic completed when topic is incomplete", async () => {
    mockCheckTopicCompletion.mockResolvedValue(false);
    mockCreateClient.mockResolvedValue(buildDb() as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.topic_completed).toBe(false);
    expect(mockMarkTopicCompleted).not.toHaveBeenCalled();
  });

  it("returns topic_completed: true and marks topic completed when all questions answered correctly", async () => {
    mockCheckTopicCompletion.mockResolvedValue(true);
    mockCreateClient.mockResolvedValue(buildDb() as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.topic_completed).toBe(true);
    expect(mockMarkTopicCompleted).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      TOPIC_ID
    );
  });

  it("skips completion check and returns topic_completed: false when topic already completed", async () => {
    mockCreateClient.mockResolvedValue(
      buildDb({ existingProgress: { status: "completed" } }) as never
    );
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.topic_completed).toBe(false);
    expect(mockCheckTopicCompletion).not.toHaveBeenCalled();
    expect(mockMarkTopicCompleted).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCreateClient.mockResolvedValue(buildDb({ rateLimitPass: false }) as never);
    const res = await POST(makeRequest(defaultBody));
    expect(res.status).toBe(429);
  });

  it("inserts new stats row for first-time user when stats are null", async () => {
    mockCreateClient.mockResolvedValue(buildDb({ stats: null }) as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.is_correct).toBe(true);
  });

  it("updates existing in_progress topic progress", async () => {
    mockCreateClient.mockResolvedValue(
      buildDb({ existingProgress: { status: "in_progress" } }) as never
    );
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.topic_completed).toBe(false);
  });

  it("awards streak milestone medal when streak reaches 3", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("sv", {
      timeZone: "Asia/Jerusalem",
    });
    mockCreateClient.mockResolvedValue(
      buildDb({ stats: { star_points: 0, streak_days: 2, last_active_date: yesterday } }) as never
    );
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.medals_earned).toContain("streak-3");
  });

  it("handles db error gracefully when marking topic completed", async () => {
    mockCheckTopicCompletion.mockResolvedValue(true);
    mockMarkTopicCompleted.mockRejectedValue(new Error("DB error"));
    mockCreateClient.mockResolvedValue(buildDb() as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.topic_completed).toBe(true);
  });

  it("returns 500 when the response upsert fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(buildDb({ upsertError: true }) as never);
    const res = await POST(makeRequest(defaultBody));
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith(
      "[quiz] upsert failed:",
      expect.objectContaining({ message: "upsert failed" })
    );
    errorSpy.mockRestore();
  });

  it("does not report a medal when the medal insert fails", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("sv", {
      timeZone: "Asia/Jerusalem",
    });
    mockCreateClient.mockResolvedValue(
      buildDb({
        stats: { star_points: 0, streak_days: 2, last_active_date: yesterday },
        medalInsertError: true,
      }) as never
    );
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.medals_earned).toEqual([]);
  });

  it("passes a valid session_id through to the response upsert", async () => {
    const db = buildDb();
    mockCreateClient.mockResolvedValue(db as never);
    const sessionId = "123e4567-e89b-42d3-a456-426614174000";
    await POST(makeRequest({ ...defaultBody, session_id: sessionId }));
    expect(db.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: sessionId }),
      { onConflict: "user_id,question_id" }
    );
  });

  it("stores session_id: null when the body omits it", async () => {
    const db = buildDb();
    mockCreateClient.mockResolvedValue(db as never);
    await POST(makeRequest(defaultBody));
    expect(db.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: null }),
      { onConflict: "user_id,question_id" }
    );
  });

  it("coerces a non-UUID session_id to null", async () => {
    const db = buildDb();
    mockCreateClient.mockResolvedValue(db as never);
    await POST(makeRequest({ ...defaultBody, session_id: "'; DROP TABLE users;--" }));
    expect(db.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: null }),
      { onConflict: "user_id,question_id" }
    );
  });

  it("returns zeroed totals when updated stats cannot be fetched", async () => {
    mockCreateClient.mockResolvedValue(buildDb({ updatedStats: null }) as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.new_total_stars).toBe(0);
    expect(body.streak_days).toBe(0);
  });
});
