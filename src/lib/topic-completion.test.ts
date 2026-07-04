import { describe, it, expect, vi } from "vitest";
import { checkTopicCompletion } from "./topic-completion";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER_ID = "user-uuid";
const TOPIC_ID = "topic-uuid";
const Q1 = "q1-uuid";
const Q2 = "q2-uuid";

function makeQuestionChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue(Promise.resolve(result)),
  };
}

function makeResponseChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnValue(Promise.resolve(result)),
  };
}

function mockSupabase({
  questions,
  questionsError,
  responses,
  responsesError,
}: {
  questions?: Array<{ id: string }>;
  questionsError?: object;
  responses?: Array<{ question_id: string }>;
  responsesError?: object;
}): SupabaseClient {
  const qChain = makeQuestionChain({
    data: questions ?? null,
    error: questionsError ?? null,
  });
  const rChain = makeResponseChain({
    data: responses ?? null,
    error: responsesError ?? null,
  });

  let call = 0;
  return {
    from: vi.fn().mockImplementation(() => {
      call++;
      return call === 1 ? qChain : rChain;
    }),
  } as unknown as SupabaseClient;
}

describe("checkTopicCompletion", () => {
  it("returns false when topic has no questions", async () => {
    const supabase = mockSupabase({ questions: [] });
    expect(await checkTopicCompletion(supabase, USER_ID, TOPIC_ID)).toBe(false);
  });

  it("returns false when questions query errors", async () => {
    const supabase = mockSupabase({ questionsError: { message: "DB error" } });
    expect(await checkTopicCompletion(supabase, USER_ID, TOPIC_ID)).toBe(false);
  });

  it("returns false when user has answered no questions correctly", async () => {
    const supabase = mockSupabase({
      questions: [{ id: Q1 }, { id: Q2 }],
      responses: [],
    });
    expect(await checkTopicCompletion(supabase, USER_ID, TOPIC_ID)).toBe(false);
  });

  it("returns false when user has answered only some questions correctly", async () => {
    const supabase = mockSupabase({
      questions: [{ id: Q1 }, { id: Q2 }],
      responses: [{ question_id: Q1 }],
    });
    expect(await checkTopicCompletion(supabase, USER_ID, TOPIC_ID)).toBe(false);
  });

  it("returns true when user has answered all questions correctly", async () => {
    const supabase = mockSupabase({
      questions: [{ id: Q1 }, { id: Q2 }],
      responses: [{ question_id: Q1 }, { question_id: Q2 }],
    });
    expect(await checkTopicCompletion(supabase, USER_ID, TOPIC_ID)).toBe(true);
  });

  it("returns true even when correct answers appear more than once", async () => {
    const supabase = mockSupabase({
      questions: [{ id: Q1 }, { id: Q2 }],
      responses: [
        { question_id: Q1 },
        { question_id: Q2 },
        { question_id: Q1 },
      ],
    });
    expect(await checkTopicCompletion(supabase, USER_ID, TOPIC_ID)).toBe(true);
  });

  it("returns false when responses query errors", async () => {
    const supabase = mockSupabase({
      questions: [{ id: Q1 }],
      responsesError: { message: "DB error" },
    });
    expect(await checkTopicCompletion(supabase, USER_ID, TOPIC_ID)).toBe(false);
  });
});
