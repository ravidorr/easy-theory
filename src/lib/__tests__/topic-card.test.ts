import { describe, expect, it } from "vitest";
import { buildTopicCardMeta } from "../topic-card";

const base = {
  totalQuestions: 20,
  answeredQuestions: 5,
  progress: { status: "in_progress" as const, best_score: 90 },
};

describe("buildTopicCardMeta", () => {
  it("uses answered coverage for an in-progress topic", () => {
    expect(buildTopicCardMeta(base)).toMatchObject({
      done: false,
      answered: 5,
      total: 20,
      coveragePct: 25,
      barPct: 25,
      bestScore: 90,
    });
  });

  it("uses best score for the completed-topic progress bar", () => {
    expect(
      buildTopicCardMeta({
        ...base,
        answeredQuestions: 20,
        progress: { status: "completed", best_score: 85 },
      })
    ).toMatchObject({ done: true, coveragePct: 100, barPct: 85, bestScore: 85 });
  });

  it("clamps impossible answered counts and accepts a missing progress row", () => {
    expect(
      buildTopicCardMeta({ totalQuestions: 20, answeredQuestions: 99, progress: undefined })
    ).toMatchObject({ done: false, answered: 20, coveragePct: 100, barPct: 100 });
  });

  it("keeps a completed topic with no score visually empty rather than inventing one", () => {
    expect(
      buildTopicCardMeta({
        totalQuestions: 20,
        answeredQuestions: 20,
        progress: { status: "completed", best_score: null },
      })
    ).toMatchObject({ done: true, barPct: 0, bestScore: null });
  });
});
