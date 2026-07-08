import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { createClient } from "@/lib/supabase";
import { checkTopicCompletion } from "@/lib/topic-completion";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/topic-completion", () => ({ checkTopicCompletion: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCheckTopicCompletion = vi.mocked(checkTopicCompletion);

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
  updatedStats?: { star_points: number; streak_days: number };
  noQuestion?: boolean;
};

function buildDb({
  authenticated = true,
  correctOption = "a",
  alreadyAnsweredCorrectly = false,
  existingProgress = null,
  stats = { star_points: 0, streak_days: 0, last_active_date: null },
  updatedStats = { star_points: 10, streak_days: 1 },
  noQuestion = false,
}: DbConfig = {}) {
  const calls: Record<string, number> = {};
  const nc = (t: string) => {
    calls[t] = (calls[t] ?? 0) + 1;
    return calls[t];
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: USER_ID } : null },
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: true }),
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
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
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
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
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
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
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

  it("returns topic_completed: false and does not call /api/progress when topic is incomplete", async () => {
    mockCheckTopicCompletion.mockResolvedValue(false);
    mockCreateClient.mockResolvedValue(buildDb() as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.topic_completed).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns topic_completed: true and calls POST /api/progress when all questions answered correctly", async () => {
    mockCheckTopicCompletion.mockResolvedValue(true);
    mockCreateClient.mockResolvedValue(buildDb() as never);
    const res = await POST(makeRequest(defaultBody));
    const body = await res.json();
    expect(body.topic_completed).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/progress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topic_id: TOPIC_ID, status: "completed" }),
      })
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
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
