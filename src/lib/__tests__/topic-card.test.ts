import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  TOPIC_DIFFICULTY_BY_SLUG,
  topicDuration,
  buildTopicCardMeta,
} from "../topic-card";
import { POINTS_PER_CORRECT } from "../quiz";

describe("TOPIC_DIFFICULTY_BY_SLUG", () => {
  it("covers every slug in seeds/topics.sql, so a new topic cannot ship without a difficulty", () => {
    const sql = readFileSync(join(__dirname, "../../../seeds/topics.sql"), "utf8");
    const seededSlugs = [...sql.matchAll(/gen_random_uuid\(\), '([a-z-]+)'/g)].map(
      (match) => match[1]
    );
    expect(seededSlugs.length).toBeGreaterThan(0);
    for (const slug of seededSlugs) {
      expect(TOPIC_DIFFICULTY_BY_SLUG[slug], `missing difficulty for "${slug}"`).toBeDefined();
    }
  });
});

describe("topicDuration", () => {
  it("returns null when nothing remains", () => {
    expect(topicDuration(0)).toBeNull();
    expect(topicDuration(-5)).toBeNull();
  });

  it("uses minutes under an hour", () => {
    expect(topicDuration(30)).toEqual({ unit: "minutes", value: 20 });
    expect(topicDuration(89)).toEqual({ unit: "minutes", value: 59 });
  });

  it("never estimates below one minute", () => {
    expect(topicDuration(1)).toEqual({ unit: "minutes", value: 1 });
  });

  it("switches to rounded hours from 60 minutes up", () => {
    expect(topicDuration(90)).toEqual({ unit: "hours", value: 1 });
    expect(topicDuration(501)).toEqual({ unit: "hours", value: 6 });
  });
});

describe("buildTopicCardMeta", () => {
  const base = { slug: "signs", totalQuestions: 501, answeredQuestions: 0 };

  it("describes a not-started topic", () => {
    const meta = buildTopicCardMeta({ ...base, progress: undefined });
    expect(meta.done).toBe(false);
    expect(meta.coveragePct).toBe(0);
    expect(meta.barPct).toBe(0);
    expect(meta.remainingPoints).toBe(501 * POINTS_PER_CORRECT);
    expect(meta.duration).toEqual({ unit: "hours", value: 6 });
    expect(meta.difficulty).toBe("easy");
  });

  it("describes an in-progress topic with coverage as the bar", () => {
    const meta = buildTopicCardMeta({
      ...base,
      answeredQuestions: 250,
      progress: { status: "in_progress", best_score: 40 },
    });
    expect(meta.done).toBe(false);
    // Floor, not round: 250/501 is 49.9%, and the card must not read
    // ahead of the shared completion summary.
    expect(meta.coveragePct).toBe(49);
    expect(meta.barPct).toBe(49);
    expect(meta.remainingPoints).toBe(2510);
    expect(meta.duration).toEqual({ unit: "hours", value: 3 });
  });

  it("never shows 100% coverage while questions remain", () => {
    const meta = buildTopicCardMeta({
      ...base,
      answeredQuestions: 500,
      progress: { status: "in_progress", best_score: null },
    });
    expect(meta.coveragePct).toBe(99);
    expect(meta.barPct).toBe(99);
  });

  it("describes a completed topic with the best score and nothing left to earn", () => {
    const meta = buildTopicCardMeta({
      ...base,
      answeredQuestions: 501,
      progress: { status: "completed", best_score: 87 },
    });
    expect(meta.done).toBe(true);
    expect(meta.barPct).toBe(87);
    expect(meta.bestScore).toBe(87);
    expect(meta.remainingPoints).toBe(0);
    expect(meta.duration).toBeNull();
  });

  it("treats a completed topic with a null best score as an empty bar", () => {
    const meta = buildTopicCardMeta({
      ...base,
      answeredQuestions: 501,
      progress: { status: "completed", best_score: null },
    });
    expect(meta.barPct).toBe(0);
    expect(meta.bestScore).toBeNull();
    expect(meta.remainingPoints).toBe(0);
  });

  it("shows nothing left to earn once completed, even with unanswered questions", () => {
    const meta = buildTopicCardMeta({
      ...base,
      answeredQuestions: 400,
      progress: { status: "completed", best_score: 90 },
    });
    expect(meta.remainingPoints).toBe(0);
    expect(meta.duration).toBeNull();
  });

  it("survives a topic with zero questions", () => {
    const meta = buildTopicCardMeta({
      slug: "signs",
      totalQuestions: 0,
      answeredQuestions: 0,
      progress: undefined,
    });
    expect(meta.coveragePct).toBe(0);
    expect(meta.remainingPoints).toBe(0);
    expect(meta.duration).toBeNull();
  });

  it("leaves difficulty empty for an unknown slug", () => {
    const meta = buildTopicCardMeta({
      slug: "brand-new-topic",
      totalQuestions: 10,
      answeredQuestions: 0,
      progress: undefined,
    });
    expect(meta.difficulty).toBeNull();
  });

  it("clamps answered above the question count", () => {
    const meta = buildTopicCardMeta({
      ...base,
      answeredQuestions: 600,
      progress: { status: "in_progress", best_score: null },
    });
    expect(meta.answered).toBe(501);
    expect(meta.coveragePct).toBe(100);
    expect(meta.remainingPoints).toBe(0);
    expect(meta.duration).toBeNull();
  });
});
