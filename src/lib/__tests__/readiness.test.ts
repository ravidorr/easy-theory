import { describe, it, expect } from "vitest";
import {
  computeReadiness,
  findStrongestTopics,
  findWeakestTopics,
  READINESS_MAX_ATTEMPTS,
  WEAK_TOPIC_MIN_ANSWERS,
} from "../readiness";
import type { ExamAttempt, TopicAccuracy } from "../db";

let idCounter = 0;
function attempt(score: number, created_at: string): ExamAttempt {
  return {
    id: `e${++idCounter}`,
    score,
    total: 30,
    passed: score >= 26,
    duration_seconds: 1800,
    created_at,
  };
}

function row(topic_id: string, correct: number, total: number): TopicAccuracy {
  return { topic_id, correct, total };
}

describe("computeReadiness", () => {
  it("returns the empty variant when there are no attempts", () => {
    expect(computeReadiness([])).toEqual({
      level: null,
      probability: null,
      attemptsUsed: 0,
    });
  });

  it("gives high readiness for perfect scores, never promising 100%", () => {
    const result = computeReadiness([
      attempt(30, "2026-07-03"),
      attempt(30, "2026-07-02"),
      attempt(30, "2026-07-01"),
    ]);
    expect(result.level).toBe("high");
    // margin 4.5 → 1/(1+e^-2.25); comfortably under the 0.95 ceiling
    expect(result.probability).toBeCloseTo(0.9047, 3);
    expect(result.probability!).toBeLessThanOrEqual(0.95);
    expect(result.attemptsUsed).toBe(3);
  });

  it("gives low readiness, clamped at 0.05, for very low scores", () => {
    const result = computeReadiness([
      attempt(5, "2026-07-02"),
      attempt(4, "2026-07-01"),
    ]);
    expect(result.level).toBe("low");
    expect(result.probability).toBe(0.05);
  });

  it("maps a single attempt at the pass mark to a medium estimate", () => {
    // score 26, margin 0.5, p = 1/(1+e^-0.25) ≈ 0.562
    const result = computeReadiness([attempt(26, "2026-07-01")]);
    expect(result.level).toBe("medium");
    expect(result.probability).toBeCloseTo(0.5622, 3);
    expect(result.attemptsUsed).toBe(1);
  });

  it("weights recent attempts more heavily", () => {
    const recentLow = computeReadiness([
      attempt(20, "2026-07-02"),
      attempt(28, "2026-07-01"),
    ]);
    const recentHigh = computeReadiness([
      attempt(28, "2026-07-02"),
      attempt(20, "2026-07-01"),
    ]);
    expect(recentLow.probability!).toBeLessThan(recentHigh.probability!);
  });

  it("sorts unsorted input by created_at before weighting", () => {
    const sorted = computeReadiness([
      attempt(28, "2026-07-02"),
      attempt(20, "2026-07-01"),
    ]);
    const unsorted = computeReadiness([
      attempt(20, "2026-07-01"),
      attempt(28, "2026-07-02"),
    ]);
    expect(unsorted).toEqual(sorted);
  });

  it(`uses at most ${READINESS_MAX_ATTEMPTS} recent attempts`, () => {
    const attempts = [
      attempt(28, "2026-07-07"),
      attempt(28, "2026-07-06"),
      attempt(28, "2026-07-05"),
      attempt(28, "2026-07-04"),
      attempt(28, "2026-07-03"),
      // Older outlier that must not affect the estimate.
      attempt(0, "2026-07-01"),
    ];
    const withOutlier = computeReadiness(attempts);
    const withoutOutlier = computeReadiness(attempts.slice(0, 5));
    expect(withOutlier.attemptsUsed).toBe(READINESS_MAX_ATTEMPTS);
    expect(withOutlier.probability).toBe(withoutOutlier.probability);
  });

  it("classifies clearly failing recent scores as low", () => {
    const result = computeReadiness([
      attempt(20, "2026-07-02"),
      attempt(21, "2026-07-01"),
    ]);
    expect(result.level).toBe("low");
  });
});

describe("findWeakestTopics", () => {
  it("returns [] for empty input", () => {
    expect(findWeakestTopics([])).toEqual([]);
  });

  it(`ignores topics with fewer than ${WEAK_TOPIC_MIN_ANSWERS} answers`, () => {
    expect(findWeakestTopics([row("t1", 0, 4)])).toEqual([]);
  });

  it("ignores mastered topics (accuracy at or above 0.85)", () => {
    expect(findWeakestTopics([row("t1", 17, 20), row("t2", 20, 20)])).toEqual([]);
  });

  it("sorts by accuracy ascending", () => {
    const result = findWeakestTopics([
      row("t1", 8, 10),
      row("t2", 2, 10),
      row("t3", 5, 10),
    ]);
    expect(result.map((r) => r.topic_id)).toEqual(["t2", "t3", "t1"]);
    expect(result[0]).toEqual({ topic_id: "t2", accuracy: 0.2, total: 10 });
  });

  it("breaks accuracy ties by more answers first, then topic_id", () => {
    const result = findWeakestTopics([
      row("tb", 5, 10),
      row("ta", 5, 10),
      row("tc", 10, 20),
    ]);
    expect(result.map((r) => r.topic_id)).toEqual(["tc", "ta", "tb"]);
  });

  it("respects the limit", () => {
    const rows = [
      row("t1", 1, 10),
      row("t2", 2, 10),
      row("t3", 3, 10),
      row("t4", 4, 10),
    ];
    expect(findWeakestTopics(rows)).toHaveLength(3);
    expect(findWeakestTopics(rows, 2).map((r) => r.topic_id)).toEqual(["t1", "t2"]);
  });
});

describe("findStrongestTopics", () => {
  it("returns [] for empty input", () => {
    expect(findStrongestTopics([])).toEqual([]);
  });

  it(`ignores topics with fewer than ${WEAK_TOPIC_MIN_ANSWERS} answers`, () => {
    expect(findStrongestTopics([row("t1", 4, 4)])).toEqual([]);
  });

  it("includes a topic exactly at the 0.85 mastery boundary", () => {
    expect(findStrongestTopics([row("t1", 17, 20)])).toEqual([
      { topic_id: "t1", accuracy: 0.85, total: 20 },
    ]);
  });

  it("ignores weak topics (accuracy below 0.85)", () => {
    expect(findStrongestTopics([row("t1", 16, 20), row("t2", 5, 10)])).toEqual([]);
  });

  it("sorts by accuracy descending", () => {
    const result = findStrongestTopics([
      row("t1", 9, 10),
      row("t2", 10, 10),
      row("t3", 17, 20),
    ]);
    expect(result.map((r) => r.topic_id)).toEqual(["t2", "t1", "t3"]);
    expect(result[0]).toEqual({ topic_id: "t2", accuracy: 1, total: 10 });
  });

  it("breaks accuracy ties by more answers first, then topic_id", () => {
    const result = findStrongestTopics([
      row("tb", 9, 10),
      row("ta", 9, 10),
      row("tc", 18, 20),
    ]);
    expect(result.map((r) => r.topic_id)).toEqual(["tc", "ta", "tb"]);
  });

  it("respects the limit", () => {
    const rows = [
      row("t1", 10, 10),
      row("t2", 19, 20),
      row("t3", 18, 20),
      row("t4", 17, 20),
    ];
    expect(findStrongestTopics(rows)).toHaveLength(3);
    expect(findStrongestTopics(rows, 2).map((r) => r.topic_id)).toEqual(["t1", "t2"]);
  });

  it("is disjoint from findWeakestTopics on the same rows", () => {
    const rows = [
      row("t1", 17, 20),
      row("t2", 16, 20),
      row("t3", 3, 4),
      row("t4", 20, 20),
    ];
    const strong = findStrongestTopics(rows).map((r) => r.topic_id);
    const weak = findWeakestTopics(rows).map((r) => r.topic_id);
    expect(strong.filter((id) => weak.includes(id))).toEqual([]);
    expect([...strong, ...weak].sort()).toEqual(["t1", "t2", "t4"]);
  });
});
