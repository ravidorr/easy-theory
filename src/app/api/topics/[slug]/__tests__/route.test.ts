import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { createClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);

function makeRequest(slug: string) {
  return new Request(`http://localhost/api/topics/${slug}`);
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

// Chainable mock that is directly awaitable.
function chain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const m = {} as Record<string, unknown>;
  for (const k of ["select", "eq", "order", "limit"]) {
    m[k] = vi.fn().mockReturnValue(m);
  }
  m.single = vi.fn().mockResolvedValue(result);
  m.then = (onFulfilled: (v: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return m;
}

function makeClient({
  topic = { id: "t1" } as Record<string, unknown> | null,
  questions = [] as unknown[],
  questionsError = false,
} = {}) {
  let questionsCalled = false;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "topics") return chain(topic);
      if (table === "questions") {
        // Only return questions after topic is found
        questionsCalled = true;
        return chain(questions, questionsError ? { message: "db error" } : null);
      }
      return chain(null);
    }),
  };
}

describe("GET /api/topics/[slug]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 404 when topic is not found", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ topic: null }) as never);
    const res = await GET(makeRequest("nope"), makeParams("nope"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns the questions array for a valid slug", async () => {
    const questions = [{ id: "q1", question_he: "What?" }];
    mockCreateClient.mockResolvedValue(makeClient({ questions }) as never);
    const res = await GET(makeRequest("signs"), makeParams("signs"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(questions);
  });

  it("returns an empty array when the topic has no questions", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ questions: [] }) as never);
    const res = await GET(makeRequest("signs"), makeParams("signs"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns null-safe empty array when questions query returns null", async () => {
    mockCreateClient.mockResolvedValue(makeClient({ questions: null as never }) as never);
    const res = await GET(makeRequest("signs"), makeParams("signs"));
    expect(await res.json()).toEqual([]);
  });

  it("returns 500 when the questions query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(makeClient({ questionsError: true }) as never);
    const res = await GET(makeRequest("signs"), makeParams("signs"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    consoleSpy.mockRestore();
  });
});
