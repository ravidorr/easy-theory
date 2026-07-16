import { describe, it, expect } from "vitest";
import {
  buildGreetingContext,
  dayWindow,
  estimateMinutesRemaining,
  findResumePoint,
  pickLastStudiedInProgressTopic,
  selectFocusTopic,
} from "../personalization";
import type { QuestionRef, TopicProgress } from "../db";
import type { WeakTopic } from "../readiness";

function progress(
  topic_id: string,
  status: TopicProgress["status"],
  last_studied_at: string | null
): TopicProgress {
  return { topic_id, status, best_score: null, last_studied_at };
}

function weak(topic_id: string, accuracy = 0.5): WeakTopic {
  return { topic_id, accuracy, total: 20 };
}

describe("estimateMinutesRemaining", () => {
  it("estimates 8 minutes for 12 remaining questions at 1.5 q/min", () => {
    expect(estimateMinutesRemaining(12)).toBe(8);
  });

  it("never estimates below one minute", () => {
    expect(estimateMinutesRemaining(1)).toBe(1);
    expect(estimateMinutesRemaining(0)).toBe(1);
  });
});

describe("dayWindow", () => {
  it("returns yesterday's Jerusalem day in winter (UTC+2)", () => {
    // 2026-01-15 10:00 UTC = 12:00 in Jerusalem (IST, UTC+2)
    const { fromIso, toIso } = dayWindow(new Date("2026-01-15T10:00:00Z"), 1);
    expect(fromIso).toBe("2026-01-13T22:00:00.000Z");
    expect(toIso).toBe("2026-01-14T22:00:00.000Z");
  });

  it("returns yesterday's Jerusalem day in summer (UTC+3)", () => {
    // 2026-07-15 10:00 UTC = 13:00 in Jerusalem (IDT, UTC+3)
    const { fromIso, toIso } = dayWindow(new Date("2026-07-15T10:00:00Z"), 1);
    expect(fromIso).toBe("2026-07-13T21:00:00.000Z");
    expect(toIso).toBe("2026-07-14T21:00:00.000Z");
  });

  it("rolls the Jerusalem date over before UTC does", () => {
    // 22:30 UTC on the 14th is already 00:30 on the 15th in Jerusalem winter
    // time, so "yesterday" is the 14th.
    const { fromIso, toIso } = dayWindow(new Date("2026-01-14T22:30:00Z"), 1);
    expect(fromIso).toBe("2026-01-13T22:00:00.000Z");
    expect(toIso).toBe("2026-01-14T22:00:00.000Z");
  });

  it("lands on true local midnights across the spring-forward transition", () => {
    // Israel springs forward on 2026-03-27 at 02:00 (+2 to +3). Midnight of
    // the 27th is still +2 (22:00Z on the 26th); midnight of the 28th is +3
    // (21:00Z on the 27th), so yesterday's window is 23 hours long.
    const { fromIso, toIso } = dayWindow(new Date("2026-03-28T10:00:00Z"), 1);
    expect(fromIso).toBe("2026-03-26T22:00:00.000Z");
    expect(toIso).toBe("2026-03-27T21:00:00.000Z");
  });

  it("lands on true local midnights across the fall-back transition", () => {
    // Israel falls back on 2026-10-25 at 02:00 (+3 to +2), so yesterday's
    // window is 25 hours long.
    const { fromIso, toIso } = dayWindow(new Date("2026-10-26T10:00:00Z"), 1);
    expect(fromIso).toBe("2026-10-24T21:00:00.000Z");
    expect(toIso).toBe("2026-10-25T22:00:00.000Z");
  });
});

describe("pickLastStudiedInProgressTopic", () => {
  it("returns null for no rows", () => {
    expect(pickLastStudiedInProgressTopic([])).toBeNull();
  });

  it("returns null when nothing is in progress", () => {
    const rows = [
      progress("a", "completed", "2026-07-10T10:00:00Z"),
      progress("b", "not_started", null),
    ];
    expect(pickLastStudiedInProgressTopic(rows)).toBeNull();
  });

  it("picks the most recently studied in-progress topic", () => {
    const rows = [
      progress("a", "in_progress", "2026-07-10T10:00:00Z"),
      progress("b", "in_progress", "2026-07-12T10:00:00Z"),
      progress("c", "completed", "2026-07-14T10:00:00Z"),
    ];
    expect(pickLastStudiedInProgressTopic(rows)?.topic_id).toBe("b");
  });

  it("never lets a null last_studied_at beat a dated one", () => {
    const rows = [
      progress("a", "in_progress", null),
      progress("b", "in_progress", "2026-07-01T10:00:00Z"),
    ];
    expect(pickLastStudiedInProgressTopic(rows)?.topic_id).toBe("b");
  });
});

describe("findResumePoint", () => {
  const questions: QuestionRef[] = [
    { id: "q1", question_number: 140 },
    { id: "q2", question_number: 141 },
    { id: "q3", question_number: 142 },
    { id: "q4", question_number: 143 },
  ];

  it("returns null for an empty topic", () => {
    expect(findResumePoint([], new Set())).toBeNull();
  });

  it("returns null when everything is answered", () => {
    expect(
      findResumePoint(questions, new Set(["q1", "q2", "q3", "q4"]))
    ).toBeNull();
  });

  it("returns the first unanswered question and the remaining count", () => {
    expect(findResumePoint(questions, new Set(["q1", "q2"]))).toEqual({
      questionNumber: 142,
      remaining: 2,
    });
  });
});

describe("selectFocusTopic", () => {
  it("returns null when there are no weak topics", () => {
    expect(selectFocusTopic([], "a")).toBeNull();
  });

  it("skips the excluded topic when an alternative exists", () => {
    expect(selectFocusTopic([weak("a"), weak("b")], "a")?.topic_id).toBe("b");
  });

  it("falls back to the excluded topic when it is the only weak one", () => {
    expect(selectFocusTopic([weak("a")], "a")?.topic_id).toBe("a");
  });
});

describe("buildGreetingContext", () => {
  const now = new Date("2026-07-15T10:00:00Z");

  it("returns nothing for a brand-new user", () => {
    expect(
      buildGreetingContext({
        resume: null,
        yesterday: null,
        focusTopicId: null,
        now,
      })
    ).toEqual([]);
  });

  it("hides yesterday's accuracy when there was no activity", () => {
    expect(
      buildGreetingContext({
        resume: null,
        yesterday: { correct: 0, total: 0 },
        focusTopicId: null,
        now,
      })
    ).toEqual([]);
  });

  it("marks yesterday as good exactly at the 80% boundary", () => {
    const [line] = buildGreetingContext({
      resume: null,
      yesterday: { correct: 8, total: 10 },
      focusTopicId: null,
      now,
    });
    expect(line).toEqual({ kind: "yesterday", percent: 80, good: true });

    const [lowLine] = buildGreetingContext({
      resume: null,
      yesterday: { correct: 7, total: 10 },
      focusTopicId: null,
      now,
    });
    expect(lowLine).toEqual({ kind: "yesterday", percent: 70, good: false });
  });

  it("puts the resume line first and caps output at two lines", () => {
    const lines = buildGreetingContext({
      resume: { topicId: "t1", questionNumber: 142, remaining: 12 },
      yesterday: { correct: 9, total: 10 },
      focusTopicId: "t2",
      now,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      kind: "resume",
      topicId: "t1",
      questionNumber: 142,
      minutes: 8,
    });
    expect(["yesterday", "focus"]).toContain(lines[1].kind);
  });

  it("rotates the second slot between consecutive Jerusalem days", () => {
    const input = {
      resume: { topicId: "t1", questionNumber: 5, remaining: 3 },
      yesterday: { correct: 9, total: 10 },
      focusTopicId: "t2",
    };
    const day1 = buildGreetingContext({
      ...input,
      now: new Date("2026-07-15T10:00:00Z"),
    });
    const day2 = buildGreetingContext({
      ...input,
      now: new Date("2026-07-16T10:00:00Z"),
    });
    expect(day1[1].kind).not.toBe(day2[1].kind);
  });

  it("drops a focus line that points at the resume topic", () => {
    const lines = buildGreetingContext({
      resume: { topicId: "t1", questionNumber: 5, remaining: 3 },
      yesterday: null,
      focusTopicId: "t1",
      now,
    });
    expect(lines.map((line) => line.kind)).toEqual(["resume"]);
  });

  it("shows both rotating lines when there is nothing to resume", () => {
    const lines = buildGreetingContext({
      resume: null,
      yesterday: { correct: 5, total: 10 },
      focusTopicId: "t2",
      now,
    });
    expect(lines.map((line) => line.kind).sort()).toEqual([
      "focus",
      "yesterday",
    ]);
  });
});
