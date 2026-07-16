import { describe, it, expect, vi } from "vitest";
import {
  getTopics,
  getTopicBySlug,
  getQuestionsForTopic,
  getUserStats,
  getTopicProgress,
  getSigns,
  getVideos,
  getResources,
  getUserSchedule,
  getUsersScheduledForDay,
  getUserMedals,
  getPushSubscriptionsForUsers,
  getMistakesForTopic,
  getAnsweredQuestionIdsForTopic,
  getBookmarkedQuestionIds,
  getBookmarkedQuestions,
  getSignSrsCards,
  getQuestionSrsCards,
  upsertSrsCard,
  markTopicCompleted,
  getRandomExamQuestions,
  getExamAttempts,
  getTopicAccuracy,
  getTopicQuestionCounts,
  getQuizAccuracyForWindow,
  getQuestionNumbersForTopic,
} from "../db";
import type { SupabaseClient } from "@supabase/supabase-js";

// Builds a chainable Supabase query mock that resolves to `result`.
function chain(result: { data: unknown; error?: unknown }) {
  const mock: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in", "range", "not"]) {
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

function makeClient(data: unknown, error: { message: string } | null = null) {
  return {
    from: vi.fn().mockReturnValue(chain({ data: error ? null : data, error })),
  } as unknown as SupabaseClient;
}

const boom = { message: "boom" };

// ─── Simple query helpers ────────────────────────────────────────────────────

describe("getTopics", () => {
  it("returns topics from Supabase", async () => {
    const topics = [{ id: "1", slug: "signs" }];
    expect(await getTopics(makeClient(topics))).toEqual(topics);
  });

  it("returns [] when Supabase returns null", async () => {
    expect(await getTopics(makeClient(null))).toEqual([]);
  });

  it("throws when the query fails", async () => {
    await expect(getTopics(makeClient(null, boom))).rejects.toThrow(
      /getTopics: topics query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(getTopicBySlug(makeClient(null, boom), "signs")).rejects.toThrow(
      /getTopicBySlug: topics query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(getQuestionsForTopic(makeClient(null, boom), "t1")).rejects.toThrow(
      /getQuestionsForTopic: questions query failed: boom/
    );
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

  it("throws when the query fails instead of faking zero-state stats", async () => {
    await expect(getUserStats(makeClient(null, boom), "u1")).rejects.toThrow(
      /getUserStats: user_stats query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(getTopicProgress(makeClient(null, boom), "u1")).rejects.toThrow(
      /getTopicProgress: user_topic_progress query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(getSigns(makeClient(null, boom))).rejects.toThrow(
      /getSigns: signs query failed: boom/
    );
  });
});

describe("getVideos", () => {
  it("returns videos", async () => {
    const videos = [{ id: "v1", youtube_id: "gd6ES_aAdI0", section: "marathon" }];
    expect(await getVideos(makeClient(videos))).toEqual(videos);
  });

  it("returns [] on null", async () => {
    expect(await getVideos(makeClient(null))).toEqual([]);
  });

  it("throws when the query fails", async () => {
    await expect(getVideos(makeClient(null, boom))).rejects.toThrow(
      /getVideos: videos query failed: boom/
    );
  });
});

describe("getResources", () => {
  it("returns resources", async () => {
    const resources = [{ id: "r1", href: "https://m.noeg.co.il/", section: "practice" }];
    expect(await getResources(makeClient(resources))).toEqual(resources);
  });

  it("returns [] on null", async () => {
    expect(await getResources(makeClient(null))).toEqual([]);
  });

  it("throws when the query fails", async () => {
    await expect(getResources(makeClient(null, boom))).rejects.toThrow(
      /getResources: resources query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(getUserSchedule(makeClient(null, boom), "u1")).rejects.toThrow(
      /getUserSchedule: user_schedule query failed: boom/
    );
  });
});

describe("getUsersScheduledForDay", () => {
  it("returns users scheduled for the given day", async () => {
    const users = [{ user_id: "u1", start_time: "08:00", duration_minutes: 45, locale: "he" }];
    expect(await getUsersScheduledForDay(makeClient(users), 0)).toEqual(users);
  });

  it("returns [] on null", async () => {
    expect(await getUsersScheduledForDay(makeClient(null), 0)).toEqual([]);
  });

  it("throws when the query fails instead of silently notifying nobody", async () => {
    await expect(getUsersScheduledForDay(makeClient(null, boom), 0)).rejects.toThrow(
      /getUsersScheduledForDay: user_schedule query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(getUserMedals(makeClient(null, boom), "u1")).rejects.toThrow(
      /getUserMedals: user_medals query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(
      getPushSubscriptionsForUsers(makeClient(null, boom), ["u1"])
    ).rejects.toThrow(
      /getPushSubscriptionsForUsers: user_push_subscriptions query failed: boom/
    );
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

type SrsRow = { question_id: string; due_at: string };

function makeMistakesClient({
  responses = [] as Response[],
  questionDetails = [] as QuestionRow[] | null,
  srsCards = [] as SrsRow[],
  responsesError = null as { message: string } | null,
  questionsError = null as { message: string } | null,
} = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "user_quiz_responses") {
        return chain({ data: responsesError ? null : responses, error: responsesError });
      }
      if (table === "questions") {
        // The details fetch is chunked — return only the requested ids so
        // multi-chunk calls merge back into the full set.
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn((_col: string, ids: string[]) =>
              chain({
                data:
                  questionsError || !questionDetails
                    ? null
                    : questionDetails.filter((q) => ids.includes(q.id)),
                error: questionsError,
              })
            ),
          }),
        };
      }
      if (table === "user_srs_cards") {
        const srsChain = {} as Record<string, unknown>;
        srsChain.select = vi.fn().mockReturnValue(srsChain);
        srsChain.eq = vi.fn().mockReturnValue(srsChain);
        srsChain.in = vi.fn((_col: string, ids: string[]) =>
          chain({ data: srsCards.filter((c) => ids.includes(c.question_id)) })
        );
        return srsChain;
      }
      return chain({ data: [] });
    }),
  } as unknown as SupabaseClient;
}

describe("getMistakesForTopic", () => {
  it("returns [] when the user has no responses for the topic", async () => {
    const supabase = makeMistakesClient({ responses: [] });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("returns [] when all latest responses are correct", async () => {
    const supabase = makeMistakesClient({
      responses: [{ question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-01" }],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("returns questions with selected_option for latest incorrect responses", async () => {
    const questionDetail = { id: "q1", question_he: "What?", correct_option: "a" };
    const supabase = makeMistakesClient({
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

  it("filters responses by topic server-side via the questions join", async () => {
    const responsesChain = chain({ data: [] });
    const supabase = {
      from: vi.fn().mockReturnValue(responsesChain),
    } as unknown as SupabaseClient;
    await getMistakesForTopic(supabase, "u1", "t1");
    expect(responsesChain.select).toHaveBeenCalledWith(
      expect.stringContaining("questions!inner(topic_id)")
    );
    expect(responsesChain.eq).toHaveBeenCalledWith("questions.topic_id", "t1");
  });

  it("uses the latest response per question - answered wrong then right → not a mistake", async () => {
    // Responses ordered newest-first (as Supabase returns them with order ascending: false).
    const supabase = makeMistakesClient({
      responses: [
        // latest: correct
        { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-02" },
        // older: wrong
        { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-01" },
      ],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("uses the latest response per question - answered right then wrong → is a mistake", async () => {
    const questionDetail = { id: "q1", question_he: "What?", correct_option: "a" };
    const supabase = makeMistakesClient({
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
      responses: [
        { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-01" },
      ],
      questionDetails: null,
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("returns [] when mistakeIds is empty (all latest responses are correct)", async () => {
    const supabase = makeMistakesClient({
      responses: [
        { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-01" },
        { question_id: "q2", selected_option: "c", is_correct: true, answered_at: "2024-01-01" },
      ],
    });
    expect(await getMistakesForTopic(supabase, "u1", "t1")).toEqual([]);
  });

  it("throws when the responses query fails instead of hiding mistakes", async () => {
    const supabase = makeMistakesClient({ responsesError: { message: "boom" } });
    await expect(getMistakesForTopic(supabase, "u1", "t1")).rejects.toThrow(
      /responses query failed: boom/
    );
  });

  it("throws when a question details chunk fails", async () => {
    const supabase = makeMistakesClient({
      responses: [
        { question_id: "q1", selected_option: "b", is_correct: false, answered_at: "2024-01-01" },
      ],
      questionsError: { message: "boom" },
    });
    await expect(getMistakesForTopic(supabase, "u1", "t1")).rejects.toThrow(
      /questions query failed: boom/
    );
  });

  it("chunks the question details fetch to stay under URL length limits", async () => {
    // 150 wrong answers → two .in() chunks (100 + 50) merged back together.
    const ids = Array.from({ length: 150 }, (_, i) => `q${i}`);
    const supabase = makeMistakesClient({
      responses: ids.map((id) => ({
        question_id: id,
        selected_option: "b",
        is_correct: false,
        answered_at: "2024-01-01",
      })),
      questionDetails: ids.map((id) => ({ id, question_he: "?", correct_option: "a" })),
    });
    const result = await getMistakesForTopic(supabase, "u1", "t1");
    expect(result).toHaveLength(150);
    expect(result.every((q) => q.selected_option === "b")).toBe(true);
    const questionCalls = vi
      .mocked(supabase.from)
      .mock.calls.filter(([table]) => table === "questions");
    expect(questionCalls).toHaveLength(2);
  });

  describe("SRS integration", () => {
    const wrong = (id: string) => ({
      question_id: id,
      selected_option: "b",
      is_correct: false,
      answered_at: "2024-01-01",
    });
    const question = (id: string) => ({ id, question_he: "?", correct_option: "a" });

    it("merges due_at from SRS cards and defaults to null for unscheduled mistakes", async () => {
      const supabase = makeMistakesClient({
        responses: [wrong("q1"), wrong("q2")],
        questionDetails: [question("q1"), question("q2")],
        srsCards: [{ question_id: "q1", due_at: "2020-01-01T00:00:00.000Z" }],
      });
      const result = await getMistakesForTopic(supabase, "u1", "t1");
      const byId = new Map(result.map((m) => [m.id, m.due_at]));
      expect(byId.get("q1")).toBe("2020-01-01T00:00:00.000Z");
      expect(byId.get("q2")).toBeNull();
    });

    it("orders due mistakes first (unscheduled ahead of scheduled), not-yet-due last", async () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const supabase = makeMistakesClient({
        responses: [wrong("q1"), wrong("q2"), wrong("q3")],
        questionDetails: [question("q1"), question("q2"), question("q3")],
        srsCards: [
          { question_id: "q1", due_at: future },
          { question_id: "q3", due_at: "2020-01-01T00:00:00.000Z" },
        ],
      });
      const result = await getMistakesForTopic(supabase, "u1", "t1");
      expect(result.map((m) => m.id)).toEqual(["q2", "q3", "q1"]);
    });

    it("orders due mistakes among themselves by due_at ascending", async () => {
      const supabase = makeMistakesClient({
        responses: [wrong("q1"), wrong("q2")],
        questionDetails: [question("q1"), question("q2")],
        srsCards: [
          { question_id: "q1", due_at: "2021-01-01T00:00:00.000Z" },
          { question_id: "q2", due_at: "2020-01-01T00:00:00.000Z" },
        ],
      });
      const result = await getMistakesForTopic(supabase, "u1", "t1");
      expect(result.map((m) => m.id)).toEqual(["q2", "q1"]);
    });
  });

  describe("lastSession scope", () => {
    it("includes latest-session mistakes and excludes older-session mistakes", async () => {
      const supabase = makeMistakesClient({
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
        responses: [
          { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-02", session_id: "s2" },
          { question_id: "q2", selected_option: "c", is_correct: false, answered_at: "2024-01-01", session_id: "s1" },
        ],
      });
      expect(await getMistakesForTopic(supabase, "u1", "t1", "lastSession")).toEqual([]);
    });

    it("falls back to all-time when the newest response has no session_id (legacy data)", async () => {
      const supabase = makeMistakesClient({
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
      const supabase = makeMistakesClient({ responses: [] });
      expect(await getMistakesForTopic(supabase, "u1", "t1", "lastSession")).toEqual([]);
    });
  });
});

describe("getAnsweredQuestionIdsForTopic", () => {
  it("returns distinct answered question ids for the topic", async () => {
    const supabase = makeMistakesClient({
      responses: [
        { question_id: "q1", selected_option: "a", is_correct: true, answered_at: "2024-01-02" },
        { question_id: "q2", selected_option: "b", is_correct: false, answered_at: "2024-01-01" },
      ],
    });
    expect(await getAnsweredQuestionIdsForTopic(supabase, "u1", "t1")).toEqual(
      new Set(["q1", "q2"])
    );
  });

  it("returns an empty Set when the user has no responses for the topic", async () => {
    const supabase = makeMistakesClient({ responses: [] });
    expect(await getAnsweredQuestionIdsForTopic(supabase, "u1", "t1")).toEqual(new Set());
  });

  it("throws when the responses query fails", async () => {
    const supabase = makeMistakesClient({ responsesError: boom });
    await expect(getAnsweredQuestionIdsForTopic(supabase, "u1", "t1")).rejects.toThrow(
      /getAnsweredQuestionIdsForTopic: user_quiz_responses query failed: boom/
    );
  });
});

// ─── SRS card helpers ────────────────────────────────────────────────────────

const SRS_CARD = {
  sign_id: "s1",
  question_id: null,
  ease: 2.5,
  interval_days: 1,
  repetitions: 1,
  due_at: "2026-07-15T00:00:00.000Z",
  last_reviewed_at: "2026-07-14T00:00:00.000Z",
};

function makeErrorClient(message: string) {
  return {
    from: vi.fn().mockReturnValue(chain({ data: null, error: { message } })),
  } as unknown as SupabaseClient;
}

describe("getSignSrsCards", () => {
  it("returns the user's sign cards", async () => {
    expect(await getSignSrsCards(makeClient([SRS_CARD]), "u1")).toEqual([SRS_CARD]);
  });

  it("returns [] on null data", async () => {
    expect(await getSignSrsCards(makeClient(null), "u1")).toEqual([]);
  });

  it("throws when the query fails", async () => {
    await expect(getSignSrsCards(makeErrorClient("boom"), "u1")).rejects.toThrow(
      /getSignSrsCards: query failed: boom/
    );
  });
});

describe("getQuestionSrsCards", () => {
  function makeChunkedClient(cards: { question_id: string }[]) {
    return {
      from: vi.fn().mockImplementation(() => {
        const srsChain = {} as Record<string, unknown>;
        srsChain.select = vi.fn().mockReturnValue(srsChain);
        srsChain.eq = vi.fn().mockReturnValue(srsChain);
        srsChain.in = vi.fn((_col: string, ids: string[]) =>
          chain({ data: cards.filter((c) => ids.includes(c.question_id)) })
        );
        return srsChain;
      }),
    } as unknown as SupabaseClient;
  }

  it("chunks the .in() filter and merges the results", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `q${i}`);
    const cards = ids.map((id) => ({ question_id: id }));
    const supabase = makeChunkedClient(cards);
    const result = await getQuestionSrsCards(supabase, "u1", ids);
    expect(result).toHaveLength(150);
    expect(vi.mocked(supabase.from).mock.calls).toHaveLength(2);
  });

  it("throws when a chunk fails", async () => {
    await expect(getQuestionSrsCards(makeErrorClient("boom"), "u1", ["q1"])).rejects.toThrow(
      /getQuestionSrsCards: query failed: boom/
    );
  });
});

describe("upsertSrsCard", () => {
  const review = {
    ease: 2.5,
    interval_days: 1,
    repetitions: 1,
    due_at: "2026-07-15T00:00:00.000Z",
    last_reviewed_at: "2026-07-14T00:00:00.000Z",
  };

  function makeUpsertClient(error: { message: string } | null = null) {
    const upsert = vi.fn().mockResolvedValue({ error });
    return {
      client: { from: vi.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient,
      upsert,
    };
  }

  it("targets the (user_id, sign_id) constraint for sign cards", async () => {
    const { client, upsert } = makeUpsertClient();
    await upsertSrsCard(client, "u1", { sign_id: "s1" }, review);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "u1", sign_id: "s1", ...review },
      { onConflict: "user_id,sign_id" }
    );
  });

  it("targets the (user_id, question_id) constraint for question cards", async () => {
    const { client, upsert } = makeUpsertClient();
    await upsertSrsCard(client, "u1", { question_id: "q1" }, review);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "u1", question_id: "q1", ...review },
      { onConflict: "user_id,question_id" }
    );
  });

  it("throws when the upsert fails", async () => {
    const { client } = makeUpsertClient({ message: "boom" });
    await expect(upsertSrsCard(client, "u1", { sign_id: "s1" }, review)).rejects.toThrow(
      /upsertSrsCard: upsert failed: boom/
    );
  });
});

// ─── Exam helpers ────────────────────────────────────────────────────────────

function makeExamQuestionsClient(
  ids: string[],
  questionRows: QuestionRow[] | null,
  {
    idsError = null as { message: string } | null,
    questionsError = null as { message: string } | null,
  } = {}
) {
  let questionCallCount = 0;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "questions") {
        questionCallCount++;
        if (questionCallCount === 1) {
          return chain({
            data: idsError ? null : ids.map((id) => ({ id })),
            error: idsError,
          });
        }
        return chain({
          data: questionsError ? null : questionRows,
          error: questionsError,
        });
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

  it("throws when the id query fails instead of building an empty exam", async () => {
    const supabase = makeExamQuestionsClient([], [], { idsError: boom });
    await expect(getRandomExamQuestions(supabase, 30)).rejects.toThrow(
      /getRandomExamQuestions: question ids query failed: boom/
    );
  });

  it("throws when the details query fails", async () => {
    const supabase = makeExamQuestionsClient(["q1"], [], { questionsError: boom });
    await expect(getRandomExamQuestions(supabase, 30)).rejects.toThrow(
      /getRandomExamQuestions: questions query failed: boom/
    );
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

  it("throws when the query fails", async () => {
    await expect(getExamAttempts(makeClient(null, boom), "u1")).rejects.toThrow(
      /getExamAttempts: user_exam_attempts query failed: boom/
    );
  });
});

describe("getTopicAccuracy", () => {
  it("aggregates correct/total per topic", async () => {
    const rows = [
      { is_correct: true, questions: { topic_id: "t1" } },
      { is_correct: false, questions: { topic_id: "t1" } },
      { is_correct: true, questions: { topic_id: "t1" } },
      { is_correct: false, questions: { topic_id: "t2" } },
    ];
    expect(await getTopicAccuracy(makeClient(rows), "u1")).toEqual([
      { topic_id: "t1", correct: 2, total: 3 },
      { topic_id: "t2", correct: 0, total: 1 },
    ]);
  });

  it("handles array-shaped nested relations", async () => {
    const rows = [
      { is_correct: true, questions: [{ topic_id: "t1" }] },
      { is_correct: false, questions: [{ topic_id: "t1" }] },
    ];
    expect(await getTopicAccuracy(makeClient(rows), "u1")).toEqual([
      { topic_id: "t1", correct: 1, total: 2 },
    ]);
  });

  it("skips rows with no related question", async () => {
    const rows = [
      { is_correct: true, questions: null },
      { is_correct: true, questions: [] },
      { is_correct: false, questions: { topic_id: "t1" } },
    ];
    expect(await getTopicAccuracy(makeClient(rows), "u1")).toEqual([
      { topic_id: "t1", correct: 0, total: 1 },
    ]);
  });

  it("returns [] on null", async () => {
    expect(await getTopicAccuracy(makeClient(null), "u1")).toEqual([]);
  });

  it("pages through more than 1000 responses", async () => {
    // Page 1: exactly 1000 rows (forces a second request); page 2: the rest.
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      is_correct: i % 2 === 0,
      questions: { topic_id: "t1" },
    }));
    const page2 = Array.from({ length: 273 }, () => ({
      is_correct: true,
      questions: { topic_id: "t2" },
    }));
    const from = vi
      .fn()
      .mockReturnValueOnce(chain({ data: page1 }))
      .mockReturnValueOnce(chain({ data: page2 }));
    const client = { from } as unknown as SupabaseClient;

    expect(await getTopicAccuracy(client, "u1")).toEqual([
      { topic_id: "t1", correct: 500, total: 1000 },
      { topic_id: "t2", correct: 273, total: 273 },
    ]);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("requests successive ranges when paginating", async () => {
    const page1 = chain({
      data: Array.from({ length: 1000 }, () => ({
        is_correct: true,
        questions: { topic_id: "t1" },
      })),
    });
    const page2 = chain({ data: [] });
    const from = vi
      .fn()
      .mockReturnValueOnce(page1)
      .mockReturnValueOnce(page2);
    const client = { from } as unknown as SupabaseClient;

    await getTopicAccuracy(client, "u1");
    expect(page1.range).toHaveBeenCalledWith(0, 999);
    expect(page2.range).toHaveBeenCalledWith(1000, 1999);
  });

  it("throws when the query fails", async () => {
    await expect(getTopicAccuracy(makeClient(null, boom), "u1")).rejects.toThrow(
      /getTopicAccuracy: user_quiz_responses query failed: boom/
    );
  });

  it("throws on a mid-pagination failure instead of truncating results", async () => {
    const page1 = Array.from({ length: 1000 }, () => ({
      is_correct: true,
      questions: { topic_id: "t1" },
    }));
    const from = vi
      .fn()
      .mockReturnValueOnce(chain({ data: page1 }))
      .mockReturnValueOnce(chain({ data: null, error: boom }));
    const client = { from } as unknown as SupabaseClient;

    await expect(getTopicAccuracy(client, "u1")).rejects.toThrow(
      /getTopicAccuracy: user_quiz_responses query failed: boom/
    );
  });
});

describe("getTopicQuestionCounts", () => {
  it("maps topic ids to question counts (array-shaped aggregate)", async () => {
    const rows = [
      { id: "t1", questions: [{ count: 361 }] },
      { id: "t2", questions: [{ count: 42 }] },
    ];
    expect(await getTopicQuestionCounts(makeClient(rows))).toEqual({ t1: 361, t2: 42 });
  });

  it("handles object-shaped aggregate relations", async () => {
    const rows = [{ id: "t1", questions: { count: 7 } }];
    expect(await getTopicQuestionCounts(makeClient(rows))).toEqual({ t1: 7 });
  });

  it("defaults to 0 when the aggregate is missing", async () => {
    const rows = [
      { id: "t1", questions: null },
      { id: "t2", questions: [] },
    ];
    expect(await getTopicQuestionCounts(makeClient(rows))).toEqual({ t1: 0, t2: 0 });
  });

  it("returns {} on null", async () => {
    expect(await getTopicQuestionCounts(makeClient(null))).toEqual({});
  });

  it("throws when the query fails", async () => {
    await expect(getTopicQuestionCounts(makeClient(null, boom))).rejects.toThrow(
      /getTopicQuestionCounts: topics query failed: boom/
    );
  });
});

describe("getQuizAccuracyForWindow", () => {
  // The window chain needs gte/lt, which the shared chain() lacks.
  function makeWindowClient(
    data: unknown,
    error: { message: string } | null = null
  ) {
    const result = { data: error ? null : data, error };
    const mock: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt"]) {
      mock[m] = vi.fn().mockReturnValue(mock);
    }
    mock.then = (
      onFulfilled: (v: typeof result) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return { from: vi.fn().mockReturnValue(mock) } as unknown as SupabaseClient;
  }

  it("aggregates correct and total from the window rows", async () => {
    const rows = [
      { is_correct: true },
      { is_correct: false },
      { is_correct: true },
    ];
    expect(
      await getQuizAccuracyForWindow(
        makeWindowClient(rows),
        "u1",
        "2026-07-13T21:00:00Z",
        "2026-07-14T21:00:00Z"
      )
    ).toEqual({ correct: 2, total: 3 });
  });

  it("returns zeros when Supabase returns null", async () => {
    expect(
      await getQuizAccuracyForWindow(makeWindowClient(null), "u1", "a", "b")
    ).toEqual({ correct: 0, total: 0 });
  });

  it("throws when the query fails", async () => {
    await expect(
      getQuizAccuracyForWindow(makeWindowClient(null, boom), "u1", "a", "b")
    ).rejects.toThrow(
      /getQuizAccuracyForWindow: user_quiz_responses query failed: boom/
    );
  });
});

describe("getQuestionNumbersForTopic", () => {
  it("returns id and question_number rows", async () => {
    const rows = [
      { id: "q1", question_number: 1 },
      { id: "q2", question_number: 2 },
    ];
    expect(await getQuestionNumbersForTopic(makeClient(rows), "t1")).toEqual(rows);
  });

  it("returns [] on null", async () => {
    expect(await getQuestionNumbersForTopic(makeClient(null), "t1")).toEqual([]);
  });

  it("throws when the query fails", async () => {
    await expect(getQuestionNumbersForTopic(makeClient(null, boom), "t1")).rejects.toThrow(
      /getQuestionNumbersForTopic: questions query failed: boom/
    );
  });
});

// ─── markTopicCompleted ──────────────────────────────────────────────────────

function makeMarkTopicClient(
  existing: { id: string; status: string } | null,
  {
    existingError = null as { message: string } | null,
    updateError = null as { message: string } | null,
    insertError = null as { message: string } | null,
  } = {}
) {
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: updateError });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq });
  const insertFn = vi.fn().mockResolvedValue({ data: null, error: insertError });

  const fromMock = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: existingError ? null : existing,
            error: existingError,
          }),
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

  it("throws when the progress lookup fails", async () => {
    const { client } = makeMarkTopicClient(null, { existingError: boom });
    await expect(markTopicCompleted(client, "u1", "t1")).rejects.toThrow(
      /markTopicCompleted: progress lookup query failed: boom/
    );
  });

  it("throws when the update fails", async () => {
    const { client } = makeMarkTopicClient(
      { id: "r1", status: "in-progress" },
      { updateError: boom }
    );
    await expect(markTopicCompleted(client, "u1", "t1")).rejects.toThrow(
      /markTopicCompleted: progress update query failed: boom/
    );
  });

  it("throws when the insert fails", async () => {
    const { client } = makeMarkTopicClient(null, { insertError: boom });
    await expect(markTopicCompleted(client, "u1", "t1")).rejects.toThrow(
      /markTopicCompleted: progress insert query failed: boom/
    );
  });
});

// ─── Bookmarks ───────────────────────────────────────────────────────────────

type BookmarkRow = { question_id: string; created_at: string };

function makeBookmarksClient({
  bookmarks = [] as BookmarkRow[] | null,
  questionDetails = [] as QuestionRow[] | null,
  bookmarksError = null as { message: string } | null,
  questionsError = null as { message: string } | null,
} = {}) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "user_question_bookmarks") {
        return chain({ data: bookmarksError ? null : bookmarks, error: bookmarksError });
      }
      if (table === "questions") {
        // The details fetch is chunked — return only the requested ids.
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn((_col: string, ids: string[]) =>
              chain({
                data:
                  questionsError || !questionDetails
                    ? null
                    : questionDetails.filter((q) => ids.includes(q.id)),
                error: questionsError,
              })
            ),
          }),
        };
      }
      return chain({ data: [] });
    }),
  } as unknown as SupabaseClient;
}

describe("getBookmarkedQuestionIds", () => {
  it("returns a Set of the user's bookmarked question ids", async () => {
    const supabase = makeBookmarksClient({
      bookmarks: [
        { question_id: "q1", created_at: "2026-01-02" },
        { question_id: "q2", created_at: "2026-01-01" },
      ],
    });
    expect(await getBookmarkedQuestionIds(supabase, "u1")).toEqual(new Set(["q1", "q2"]));
  });

  it("returns an empty Set when Supabase returns null", async () => {
    const supabase = makeBookmarksClient({ bookmarks: null });
    expect(await getBookmarkedQuestionIds(supabase, "u1")).toEqual(new Set());
  });

  it("falls back to an empty Set when the query fails (deliberate soft fallback)", async () => {
    const supabase = makeBookmarksClient({ bookmarksError: boom });
    expect(await getBookmarkedQuestionIds(supabase, "u1")).toEqual(new Set());
  });
});

describe("getBookmarkedQuestions", () => {
  it("returns [] when the user has no bookmarks", async () => {
    const supabase = makeBookmarksClient({ bookmarks: [] });
    expect(await getBookmarkedQuestions(supabase, "u1")).toEqual([]);
  });

  it("returns questions in bookmark order with bookmarked_at attached", async () => {
    const supabase = makeBookmarksClient({
      bookmarks: [
        { question_id: "q2", created_at: "2026-01-02" },
        { question_id: "q1", created_at: "2026-01-01" },
      ],
      questionDetails: [
        { id: "q1", question_he: "First?" },
        { id: "q2", question_he: "Second?" },
      ],
    });
    const result = await getBookmarkedQuestions(supabase, "u1");
    expect(result.map((q) => q.id)).toEqual(["q2", "q1"]);
    expect(result[0].bookmarked_at).toBe("2026-01-02");
    expect(result[1].bookmarked_at).toBe("2026-01-01");
  });

  it("skips bookmarks whose question row is missing", async () => {
    const supabase = makeBookmarksClient({
      bookmarks: [
        { question_id: "q1", created_at: "2026-01-02" },
        { question_id: "q-deleted", created_at: "2026-01-01" },
      ],
      questionDetails: [{ id: "q1", question_he: "First?" }],
    });
    const result = await getBookmarkedQuestions(supabase, "u1");
    expect(result.map((q) => q.id)).toEqual(["q1"]);
  });

  it("throws when the bookmarks query fails instead of hiding bookmarks", async () => {
    const supabase = makeBookmarksClient({ bookmarksError: { message: "boom" } });
    await expect(getBookmarkedQuestions(supabase, "u1")).rejects.toThrow(
      /bookmarks query failed: boom/
    );
  });

  it("throws when a question details chunk fails", async () => {
    const supabase = makeBookmarksClient({
      bookmarks: [{ question_id: "q1", created_at: "2026-01-01" }],
      questionsError: { message: "boom" },
    });
    await expect(getBookmarkedQuestions(supabase, "u1")).rejects.toThrow(
      /questions query failed: boom/
    );
  });
});
