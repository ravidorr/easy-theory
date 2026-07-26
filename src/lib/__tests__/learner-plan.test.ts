import { describe, expect, it } from "vitest";
import { readinessConfidence, recommendedTopicIds } from "../learner-plan";

describe("readinessConfidence", () => {
  it("uses evidence thresholds", () => {
    expect(readinessConfidence(0, 0)).toBe("low");
    expect(readinessConfidence(1, 0)).toBe("medium");
    expect(readinessConfidence(0, 45)).toBe("medium");
    expect(readinessConfidence(3, 30)).toBe("high");
  });
});

describe("recommendedTopicIds", () => {
  const topics = [
    { topic_id: "safety", correct: 2, total: 10 },
    { topic_id: "signs", correct: 1, total: 10 },
    { topic_id: "vehicle", correct: 1, total: 10 },
  ];

  it("prioritizes the weakest topics and breaks ties predictably", () => {
    expect(recommendedTopicIds(topics, { safety: 100, signs: 100, vehicle: 100 }, 2)).toEqual([
      "signs",
      "vehicle",
    ]);
  });

  it("supports zero totals, missing counts, and the default limit", () => {
    expect(recommendedTopicIds([{ topic_id: "empty", correct: 0, total: 0 }], {})).toEqual(["empty"]);
    expect(recommendedTopicIds(topics, {})).toHaveLength(3);
  });
});
