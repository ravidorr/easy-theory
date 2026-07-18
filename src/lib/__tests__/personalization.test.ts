import { describe, it, expect } from "vitest";
import { dayWindow, selectNextTopic } from "../personalization";
import type { TopicProgress } from "../db";

describe("dayWindow", () => {
  it("returns yesterday's Jerusalem day in winter", () => {
    const { fromIso, toIso } = dayWindow(new Date("2026-01-15T10:00:00Z"), 1);
    expect(fromIso).toBe("2026-01-13T22:00:00.000Z");
    expect(toIso).toBe("2026-01-14T22:00:00.000Z");
  });

  it("returns yesterday's Jerusalem day in summer", () => {
    const { fromIso, toIso } = dayWindow(new Date("2026-07-15T10:00:00Z"), 1);
    expect(fromIso).toBe("2026-07-13T21:00:00.000Z");
    expect(toIso).toBe("2026-07-14T21:00:00.000Z");
  });

  it("lands on true local midnights across daylight-saving transitions", () => {
    expect(dayWindow(new Date("2026-03-28T10:00:00Z"), 1)).toEqual({
      fromIso: "2026-03-26T22:00:00.000Z",
      toIso: "2026-03-27T21:00:00.000Z",
    });
    expect(dayWindow(new Date("2026-10-26T10:00:00Z"), 1)).toEqual({
      fromIso: "2026-10-24T21:00:00.000Z",
      toIso: "2026-10-25T22:00:00.000Z",
    });
  });
});

describe("selectNextTopic", () => {
  const topics = [{ id: "a" }, { id: "b" }, { id: "c" }];

  function statuses(map: Record<string, TopicProgress["status"]>) {
    return Object.fromEntries(Object.entries(map).map(([id, status]) => [id, { status }]));
  }

  it("prefers an eligible in-progress topic", () => {
    expect(
      selectNextTopic(topics, statuses({ a: "in_progress", c: "in_progress" }), "a")?.id
    ).toBe("c");
  });

  it("falls back to the first eligible untouched topic", () => {
    expect(
      selectNextTopic(topics, statuses({ a: "completed", b: "not_started" }), "a")?.id
    ).toBe("b");
  });

  it("skips topics that are not eligible", () => {
    expect(
      selectNextTopic(
        topics,
        statuses({ a: "in_progress", b: "in_progress", c: "not_started" }),
        null,
        (topic) => topic.id !== "a"
      )?.id
    ).toBe("b");
  });
});
