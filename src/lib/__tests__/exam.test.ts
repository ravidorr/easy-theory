import { describe, it, expect } from "vitest";
import {
  EXAM_QUESTION_COUNT,
  EXAM_DURATION_SECONDS,
  EXAM_PASS_MARK,
  shuffle,
  sampleIds,
  scoreExam,
} from "../exam";

describe("exam constants", () => {
  it("match the real Israeli theory test format", () => {
    expect(EXAM_QUESTION_COUNT).toBe(30);
    expect(EXAM_DURATION_SECONDS).toBe(2400);
    expect(EXAM_PASS_MARK).toBe(26);
    expect(EXAM_PASS_MARK).toBeLessThanOrEqual(EXAM_QUESTION_COUNT);
  });
});

describe("shuffle", () => {
  it("returns a permutation of the input", () => {
    const items = ["a", "b", "c", "d", "e"];
    const result = shuffle(items);
    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual([...items].sort());
  });

  it("does not mutate the input array", () => {
    const items = [1, 2, 3];
    shuffle(items);
    expect(items).toEqual([1, 2, 3]);
  });

  it("is deterministic with an injected rng", () => {
    // rng always 0 → every swap targets index 0.
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([7])).toEqual([7]);
  });
});

describe("sampleIds", () => {
  it("returns exactly `count` ids when enough exist", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `q${i}`);
    const picked = sampleIds(ids, 30);
    expect(picked).toHaveLength(30);
    expect(new Set(picked).size).toBe(30);
    for (const id of picked) expect(ids).toContain(id);
  });

  it("returns all ids when fewer than `count` exist", () => {
    const picked = sampleIds(["q1", "q2"], 30);
    expect([...picked].sort()).toEqual(["q1", "q2"]);
  });

  it("returns [] for empty input", () => {
    expect(sampleIds([], 30)).toEqual([]);
  });

  it("uses the injected rng", () => {
    expect(sampleIds(["a", "b", "c"], 2, () => 0)).toEqual(["b", "c"]);
  });
});

describe("scoreExam", () => {
  const correctById = new Map([
    ["q1", "a"],
    ["q2", "b"],
    ["q3", "c"],
  ]);

  it("scores all-correct answers", () => {
    const { score, results } = scoreExam(
      [
        { question_id: "q1", selected_option: "a" },
        { question_id: "q2", selected_option: "b" },
        { question_id: "q3", selected_option: "c" },
      ],
      correctById
    );
    expect(score).toBe(3);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.is_correct)).toBe(true);
  });

  it("scores all-wrong answers", () => {
    const { score, results } = scoreExam(
      [
        { question_id: "q1", selected_option: "b" },
        { question_id: "q2", selected_option: "a" },
      ],
      correctById
    );
    expect(score).toBe(0);
    expect(results.every((r) => !r.is_correct)).toBe(true);
  });

  it("includes selected and correct options in results", () => {
    const { results } = scoreExam(
      [{ question_id: "q1", selected_option: "b" }],
      correctById
    );
    expect(results[0]).toEqual({
      question_id: "q1",
      selected_option: "b",
      correct_option: "a",
      is_correct: false,
    });
  });

  it("keeps the last answer when a question is answered twice", () => {
    const { score, results } = scoreExam(
      [
        { question_id: "q1", selected_option: "b" },
        { question_id: "q1", selected_option: "a" },
      ],
      correctById
    );
    expect(score).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0].selected_option).toBe("a");
  });

  it("ignores answers for unknown questions", () => {
    const { score, results } = scoreExam(
      [{ question_id: "unknown", selected_option: "a" }],
      correctById
    );
    expect(score).toBe(0);
    expect(results).toEqual([]);
  });

  it("treats invalid options as wrong", () => {
    const { score, results } = scoreExam(
      [{ question_id: "q1", selected_option: "z" }],
      correctById
    );
    expect(score).toBe(0);
    expect(results[0].is_correct).toBe(false);
  });

  it("returns zero score for no answers (unanswered = wrong)", () => {
    const { score, results } = scoreExam([], correctById);
    expect(score).toBe(0);
    expect(results).toEqual([]);
  });
});
