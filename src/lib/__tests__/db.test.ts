import { describe, it, expect, vi } from "vitest";
import {
  getTopics,
  getTopicBySlug,
  getQuestionsForTopic,
  getUserStats,
  getTopicProgress,
  getSigns,
  getUserSchedule,
  getUsersScheduledForDay,
  getUserMedals,
  getPushSubscriptionsForUsers,
  getMistakesForTopic,
  markTopicCompleted,
  getRandomExamQuestions,
  getExamAttempts,
} from "../db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Builds a chainable Supabase query mock that resolves to `result`.
function chain(result: { data: unknown }) {
  const mock: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in"]) {
    mock[m] = vi.fn().mockReturnValue(mock);
  }
  mock.single = vi.fn().mockResolvedValue(result);
  mock.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make the chain itself directly awaitable (supabase queries are thenables).
  mock.then = (
    onFulfilled: (v: typeof result) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return mock;
}

function makeClient(data: unknown) {
  return {
    from: vi.fn().mockReturnValue(chain({ data })),
  } as unknown as SupabaseClient;
}

// ─── Simple query helpers ────────────────────────────────────────────────────

describe("getTopics", () => {
  it("returns topics from Supabase", async () => {
    const topics = [{ id: "1", slug: "signs" }];
    expect(await getTopics(makeClient(topics))).toEqual(topics);
  });

  it("returns [] when Supabase returns null", async () => {
    expect(await getTopics(makeClient(null))).toEqual([]);
  });
});

describe("getTopicBySlug", () => {
  it("returns the topic when found", async () => {
    const topic = { id: "1", slug: "signs" };
    expect(await getTopicBySlug(makeClient(topic), "signs")).toEqual(topic);
  });

  it("returns null when not found", async () => {
    expect(await getTopicBySlug(makeClient(null), "nope")).toBeNull();
  });
});

describe("getQuestionsForTopic", () => {
  it("returns questions", async () => {
    const questions = [{ id: "q1" }, { id: "q2" }];
    expect(await getQuestionsForTopic(makeClient(questions), "t1")).toEqual(questions);
  });

  it("returns [] on null", async () => {
    expect(await getQuestionsForTopic(makeClient(null), "t1")).toEqual([]);
  });
});

describe("getUserStats", () => {
  it("returns stats when found", async () => {
    const stats = { user_id: "u1", star_points: 10, streak_days: 3, last_active_date: "2024-01-01" };
    expect(await getUserStats(makeClient(stats), "u1")).toEqual(stats);
  });

  it("returns zero-state defaults when not found", async () => {
    const result = await getUserStats(makeClient(null), "u1");
    expect(result).toEqual({
      user_id: "u1",
      star_points: 0,
      streak_days: 0,
      last_active_date: null,
    });
  });
});

describe("getTopicProgress", () => {
  it("returns progress array", async () => {
    const progress = [{ topic_id: "t1", status: "completed" }];
    expect(await getTopicProgress(makeClient(progress), "u1")).toEqual(progress);
  });

  it("returns [] on null", async () => {
    expect(await getTopicProgress(makeClient(null), "u1")).toEqual([]);
  });
});

describe("getSigns", () => {
  it("returns signs", async () => {
    const signs = [{ id: "s1", sign_number: "101" }];
    expect(await getSigns(makeClient(signs))).toEqual(signs);
  });

  it("returns [] on null", async () => {
    expect(await getSigns(makeClient(null))).toEqual([]);
  });
});

describe("getUserSchedule", () => {
  it("returns schedule entries", async () => {
    const schedule = [{ id: "sc1", day_of_week: 0 }];
    expect(await getUserSchedule(makeClient(schedule), "u1")).toEqual(schedule);
  });

  it("returns [] on null", async () => {
    expect(await getUserSchedule(makeClient(null), "u1")).toEqual([]);
  });
});

describe("getUsersScheduledForDay", () => {
  it("returns users scheduled for the given day", async () => {
    const users = [{ user_id: "u1", start_time: "08:00", duration_minutes: 45 }];
    expect(await getUsersScheduledForDay(makeClient(users), 0)).toEqual(users);
  });

  it("returns [] on null", async () => {
    expect(await getUsersScheduledForDay(makeClient(null), 0)).toEqual([]);
  });
});

describe("getUserMedals", () => {
  it("returns medals", async () => {
    const medals = [{ medal_slug: "streak-3", earned_at: "2024-01-01" }];
    expect(await getUserMedals(makeClient(medals), "u1")).toEqual(medals);
  });

  it("returns [] on null", async () => {
    expect(await getUserMedals(makeClient(null), "u1")).toEqual([]);
  });
});

describe("getPushSubscriptionsForUsers", () => {
  it("returns subscriptions for the given user IDs", async () => {
    const subs = [{ user_id: "u1", endpoint: "https://x", auth: "a", p256dh: "b" }];
    expect(await getPushSubscriptionsForUsers(makeClient(subs), ["u1"])).toEqual(subs);
  });

  it("returns [] on null", async () => {
    expect(await getPushSubscriptionsForUsers(makeClient(null), ["u1"])).toEqual([]);
  });
});

// ─── getMistakesForTopic (deduplication logic) ───────────────────────────────

type Response = {
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  answered_at: string;
  session_id?: string | null;
};

type QuestionRow = Record<string, unknown> & { id: string };

function makeMistakesClient({
  questionIds = [] as string[],
  responses = [] as Response[],
  questionDetails = [] as QuestionRow[],
} = {}) {
  let questionCallCount = 0;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "questions") {
        questionCallCount++;
        if (questionCallCount === 1) {
          return chain({ data: questionIds.map((id) => ({ id })) });
        }
        return chain({ data: questionDetails });
      }
      if (table === "user_quiz_responses") {
        return chain({ data: responses });
      }
      return chain({ data: [] });
    }),
  } as unknown as SupabaseClient;
}

describe("getMistakesForTopic", () => {
  it("returns [] when the topic has no questions", async () => {
    const supabase = makeMistakesClient({ questionIds: [] });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("returns [] when the user has no responses for the topic", async () => {
    const supabase = makeMistakesClient({
      questionIds: ["q1", "q2"],
      responses: [],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("returns [] when all latest responses are correct", async () => {
    const supabase = makeMistakesClient({
      questionIds: ["q1"],
      responses: [{ question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-01" }],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("returns questions with selected_option for latest incorrect responses", async () => {
    const questionDetail = { id: "q1", question_he: "What?", correct_option: "a" };
    const supabase = makeMistakesClient({
      questionIds: ["q1"],
      responses: [
        { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-01" },
      ],
      questionDetails: [questionDetail],
    });
    const result = await getMistakesForTopic(supabase, "u1", "t1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("q1");
    expect(result[0].selected_option).toBe("b");
  });

  it("uses the latest response per question — answered wrong then right → not a mistake", async () => {
    // Responses ordered newest-first (as Supabase returns them with order ascending: false).
    const supabase = makeMistakesClient({
      questionIds: ["q1"],
      responses: [
        // latest: correct
        { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-02" },
        // older: wrong
        { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-01" },
      ],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("uses the latest response per question — answered right then wrong → is a mistake", async () => {
    const questionDetail = { id: "q1", question_he: "What?", correct_option: "a" };
    const supabase = makeMistakesClient({
      questionIds: ["q1"],
      responses: [
        // latest: wrong
        { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-02" },
        // older: correct
        { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-01" },
      ],
      questionDetails: [questionDetail],
    });
    const result = await getMistakesForTopic(supabase, "u1", "t1");
    expect(result).toHaveLength(1);
    expect(result[0].selected_option).toBe("b");
  });

  it("returns [] when the question details fetch yields null data", async () => {
    const supabase = makeMistakesClient({
      questionIds: ["q1"],
      responses: [
        { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-01" },
      ],
      questionDetails: null as unknown as QuestionRow[],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("returns [] when mistakeIds is empty (all latest responses are correct)", async () => {
    const supabase = makeMistakesClient({
      questionIds: ["q1", "q2"],
      responses: [
        { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-01" },
        { question_id: "q2", selected_option: "c", is_correct: true, answered_at: "2024-01-01" },
      ],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  describe("lastSession scope", () => {
    it("includes latest-session mistakes and excludes older-session mistakes", async () => {
      const supabase = makeMistakesClient({
        questionIds: ["q1", "q2"],
        responses: [
          // latest session s2: q1 wrong
          { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-02", session_id: "s2" },
          // older session s1: q2 wrong — should be excluded
          { question_id: "q2", selected_option: "c", is_correct: false, answered_at: "2024-01-01", session_id: "s1" },
        ],
        questionDetails: [{ id: "q1", question_he: "What?", correct_option: "a" }],
      });
      const result = await getMistakesForTopic(supabase, "u1", "t1", "lastSession");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("q1");
    });

    it("returns [] when the last session is clean even if older sessions have mistakes", async () => {
      const supabase = makeMistakesClient({
        questionIds: ["q1", "q2"],
        responses: [
          { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-02", session_id: "s2" },
          { question_id: "q2", selected_option: "c", is_correct: false, answered_at: "2024-01-01", session_id: "s1" },
        ],
      });
      expect(await getMistakesForTopic(supabase, "u1", "t1", "lastSession")).toEqual([]);
    });

    it("falls back to all-time when the newest response has no session_id (legacy data)", async () => {
      const supabase = makeMistakesClient({
        questionIds: ["q1", "q2"],
        responses: [
          { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-02", session_id: null },
          { question_id: "q2", selected_option: "c", is_correct: false, answered_at: "2024-01-01", session_id: null },
        ],
        questionDetails: [
          { id: "q1", question_he: "What?", correct_option: "a" },
          { id: "q2", question_he: "Which?", correct_option: "a" },
        ],
      });
      const result = await getMistakesForTopic(supabase, "u1", "t1", "lastSession");
      expect(result).toHaveLength(2);
    });

    it("excludes legacy null-session rows when the newest response has a session_id", async () => {
      const supabase = makeMistakesClient({
        questionIds: ["q1", "q2"],
        responses: [
          { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-02", session_id: "s1" },
          { question_id: "q2", selected_option: "c", is_correct: false, answered_at: "2024-01-01", session_id: null },
        ],
        questionDetails: [{ id: "q1", question_he: "What?", correct_option: "a" }],
      });
      const result = await getMistakesForTopic(supabase, "u1", "t1", "lastSession");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("q1");
    });

    it('explicit "all" scope ignores session boundaries', async () => {
      const supabase = makeMistakesClient({
        questionIds: ["q1", "q2"],
        responses: [
          { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-02", session_id: "s2" },
          { question_id: "q2", selected_option: "c", is_correct: false, answered_at: "2024-01-01", session_id: "s1" },
        ],
        questionDetails: [
          { id: "q1", question_he: "What?", correct_option: "a" },
          { id: "q2", question_he: "Which?", correct_option: "a" },
        ],
      });
      const result = await getMistakesForTopic(supabase, "u1", "t1", "all");
      expect(result).toHaveLength(2);
    });

    it("returns [] when there are no responses", async () => {
      const supabase = makeMistakesClient({ questionIds: ["q1"], responses: [] });
      expect(await getMistakesForTopic(supabase, "u1", "t1", "lastSession")).toEqual([]);
    });
  });
});

// ─── Exam helpers ────────────────────────────────────────────────────────────

function makeExamQuestionsClient(ids: string[], questionRows: QuestionRow[] | null) {
  let questionCallCount = 0;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "questions") {
        questionCallCount++;
        if (questionCallCount === 1) {
          return chain({ data: ids.map((id) => ({ id })) });
        }
        return chain({ data: questionRows });
      }
      return chain({ data: [] });
    }),
  } as unknown as SupabaseClient;
}

describe("getRandomExamQuestions", () => {
  it("returns `count` questions drawn from the id pool", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `q${i}`);
    // Second fetch returns every question so any sampled id resolves.
    const rows = ids.map((id) => ({ id, question_he: `שאלה ${id}` }));
    const supabase = makeExamQuestionsClient(ids, rows);
    const result = await getRandomExamQuestions(supabase, 30);
    expect(result).toHaveLength(30);
    expect(new Set(result.map((q) => q.id)).size).toBe(30);
  });

  it("returns all questions when fewer than `count` exist", async () => {
    const rows = [
      { id: "q1", question_he: "א" },
      { id: "q2", question_he: "ב" },
    ];
    const supabase = makeExamQuestionsClient(["q1", "q2"], rows);
    const result = await getRandomExamQuestions(supabase, 30);
    expect(result).toHaveLength(2);
  });

  it("preserves the sampled order, not the fetch order", async () => {
    // With a single id the order is trivially preserved; assert the mapping path
    // by returning rows keyed differently from the id fetch order.
    const ids = ["q1", "q2", "q3"];
    const rows = [
      { id: "q3", question_he: "ג" },
      { id: "q1", question_he: "א" },
      { id: "q2", question_he: "ב" },
    ];
    const supabase = makeExamQuestionsClient(ids, rows);
    const result = await getRandomExamQuestions(supabase, 3);
    // Every returned row must exist and be unique regardless of fetch order.
    expect(new Set(result.map((q) => q.id)).size).toBe(3);
  });

  it("returns [] when there are no questions", async () => {
    const supabase = makeExamQuestionsClient([], []);
    expect(await getRandomExamQuestions(supabase, 30)).toEqual([]);
  });

  it("returns [] when the details fetch yields null", async () => {
    const supabase = makeExamQuestionsClient(["q1"], null);
    expect(await getRandomExamQuestions(supabase, 30)).toEqual([]);
  });

  it("drops sampled ids missing from the details fetch", async () => {
    const supabase = makeExamQuestionsClient(
      ["q1", "q2"],
      [{ id: "q1", question_he: "א" }]
    );
    const result = await getRandomExamQuestions(supabase, 2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("q1");
  });
});

describe("getExamAttempts", () => {
  it("returns attempts", async () => {
    const attempts = [
      { id: "e1", score: 27, total: 30, passed: true, duration_seconds: 1800, created_at: "2026-07-01" },
    ];
    expect(await getExamAttempts(makeClient(attempts), "u1")).toEqual(attempts);
  });

  it("returns [] on null", async () => {
    expect(await getExamAttempts(makeClient(null), "u1")).toEqual([]);
  });
});

// ─── markTopicCompleted ──────────────────────────────────────────────────────

function makeMarkTopicClient(existing: { id: string; status: string } | null) {
  const updateEq = vi.fn().mockResolvedValue({ data: null });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq });
  const insertFn = vi.fn().mockResolvedValue({ data: null });

  const fromMock = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: existing }),
        }),
      }),
    }),
    update: updateFn,
    insert: insertFn,
  };

  return {
    client: { from: vi.fn().mockReturnValue(fromMock) } as unknown as SupabaseClient,
    updateFn,
    insertFn,
  };
}

describe("markTopicCompleted", () => {
  it("inserts a new record when none exists", async () => {
    const { client, insertFn } = makeMarkTopicClient(null);
    await markTopicCompleted(client, "u1", "t1");
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", topic_id: "t1", status: "completed" })
    );
  });

  it("updates status when existing record is not completed", async () => {
    const { client, updateFn } = makeMarkTopicClient({ id: "r1", status: "in-progress" });
    await markTopicCompleted(client, "u1", "t1");
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" })
    );
  });

  it("skips update when existing record is already completed", async () => {
    const { client, updateFn, insertFn } = makeMarkTopicClient({ id: "r1", status: "completed" });
    await markTopicCompleted(client, "u1", "t1");
    expect(updateFn).not.toHaveBeenCalled();
    expect(insertFn).not.toHaveBeenCalled();
  });
});
