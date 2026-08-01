import { describe, it, expect } from "vitest";
import {
  pointsToReachLevel,
  levelForPoints,
  completionSummary,
  overallAccuracy,
} from "../gamification";
import { POINTS_PER_CORRECT } from "../quiz";

describe("pointsToReachLevel", () => {
  it("starts level 1 at 0 points", () => {
    expect(pointsToReachLevel(1)).toBe(0);
  });

  it("grows quadratically", () => {
    expect(pointsToReachLevel(2)).toBe(120);
    expect(pointsToReachLevel(3)).toBe(360);
    expect(pointsToReachLevel(4)).toBe(720);
  });

  it("spans the full question bank in roughly 15 levels", () => {
    const maxBankPoints = 1273 * POINTS_PER_CORRECT;
    expect(pointsToReachLevel(15)).toBeLessThanOrEqual(maxBankPoints);
    expect(pointsToReachLevel(16)).toBeGreaterThan(maxBankPoints);
  });
});

describe("levelForPoints", () => {
  it("returns level 1 with zero progress at 0 points", () => {
    expect(levelForPoints(0)).toEqual({
      level: 1,
      pointsIntoLevel: 0,
      pointsForNextLevel: 120,
      progress: 0,
    });
  });

  it("advances exactly at the threshold", () => {
    expect(levelForPoints(119).level).toBe(1);
    expect(levelForPoints(120).level).toBe(2);
    expect(levelForPoints(120).pointsIntoLevel).toBe(0);
  });

  it("reports progress within the current level", () => {
    // Level 2 spans 120-360 (240 wide); 240 points is halfway through it.
    const info = levelForPoints(240);
    expect(info.level).toBe(2);
    expect(info.pointsIntoLevel).toBe(120);
    expect(info.pointsForNextLevel).toBe(240);
    expect(info.progress).toBe(0.5);
  });

  it("clamps negative and fractional inputs", () => {
    expect(levelForPoints(-50)).toEqual(levelForPoints(0));
    expect(levelForPoints(120.9).pointsIntoLevel).toBe(0);
  });

  it("keeps progress within [0, 1]", () => {
    for (const points of [0, 1, 119, 120, 5000, 12730]) {
      const { progress } = levelForPoints(points);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });
});

describe("overallAccuracy", () => {
  it("returns null when nothing was answered", () => {
    expect(overallAccuracy([])).toBeNull();
    expect(overallAccuracy([{ topic_id: "t1", correct: 0, total: 0 }])).toBeNull();
  });

  it("aggregates across topics and rounds to a whole percent", () => {
    expect(
      overallAccuracy([
        { topic_id: "t1", correct: 3, total: 5 },
        { topic_id: "t2", correct: 2, total: 4 },
      ])
    ).toBe(56);
  });

  it("returns 100 for all-correct and 0 for all-wrong", () => {
    expect(overallAccuracy([{ topic_id: "t1", correct: 7, total: 7 }])).toBe(100);
    expect(overallAccuracy([{ topic_id: "t1", correct: 0, total: 7 }])).toBe(0);
  });
});

describe("completionSummary", () => {
  const counts = { t1: 20, t2: 10 };

  it("sums only the listed topics with the floor rule", () => {
    const summary = completionSummary(["t1", "t2"], counts, { t1: 5, t2: 4, t3: 99 });
    expect(summary).toEqual({
      totalQuestions: 30,
      answeredQuestions: 9,
      remainingQuestions: 21,
      percent: 30,
    });
  });

  it("floors the percent so it never reads 100 while questions remain", () => {
    expect(completionSummary(["t1", "t2"], counts, { t1: 20, t2: 9 }).percent).toBe(96);
    expect(completionSummary(["t1", "t2"], counts, { t1: 20, t2: 10 }).percent).toBe(100);
  });

  it("returns zeros when there are no topics or questions", () => {
    expect(completionSummary([], counts, {})).toEqual({
      totalQuestions: 0,
      answeredQuestions: 0,
      remainingQuestions: 0,
      percent: 0,
    });
  });
});
