import { describe, it, expect } from "vitest";
import {
  QUESTIONS_ACHIEVEMENT_TARGET,
  pointsToReachLevel,
  levelForPoints,
  completionSummary,
  overallAccuracy,
  deriveAchievements,
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

describe("deriveAchievements", () => {
  const fresh = {
    completedTopicCount: 0,
    totalTopicCount: 8,
    questionsAnswered: 0,
    hasPassedExam: false,
  };

  function earnedSlugs(input: typeof fresh) {
    return deriveAchievements(input)
      .filter((a) => a.earned)
      .map((a) => a.slug);
  }

  it("returns all four achievements unearned for a fresh account", () => {
    const achievements = deriveAchievements(fresh);
    expect(achievements.map((a) => a.slug)).toEqual([
      "first-topic",
      "questions-100",
      "all-topics",
      "exam-pass",
    ]);
    expect(achievements.every((a) => !a.earned)).toBe(true);
  });

  it("earns first-topic with one completed topic", () => {
    expect(earnedSlugs({ ...fresh, completedTopicCount: 1 })).toEqual(["first-topic"]);
  });

  it("earns questions-100 exactly at the target", () => {
    expect(
      earnedSlugs({ ...fresh, questionsAnswered: QUESTIONS_ACHIEVEMENT_TARGET - 1 })
    ).toEqual([]);
    expect(
      earnedSlugs({ ...fresh, questionsAnswered: QUESTIONS_ACHIEVEMENT_TARGET })
    ).toEqual(["questions-100"]);
  });

  it("earns all-topics only when every topic is completed", () => {
    expect(
      earnedSlugs({ ...fresh, completedTopicCount: 7, totalTopicCount: 8 })
    ).toEqual(["first-topic"]);
    expect(
      earnedSlugs({ ...fresh, completedTopicCount: 8, totalTopicCount: 8 })
    ).toEqual(["first-topic", "all-topics"]);
  });

  it("never earns all-topics when there are no topics", () => {
    expect(
      earnedSlugs({ ...fresh, completedTopicCount: 0, totalTopicCount: 0 })
    ).toEqual([]);
  });

  it("earns exam-pass from a passed exam", () => {
    expect(earnedSlugs({ ...fresh, hasPassedExam: true })).toEqual(["exam-pass"]);
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
