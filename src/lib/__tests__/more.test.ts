import { describe, expect, it } from "vitest";
import {
  AUTO_ADVANCE_DELAY_STEP_MS,
  autoAdvanceDelay,
  buildMoreMedalItems,
  DEFAULT_AUTO_ADVANCE_DELAY_MS,
  MAX_AUTO_ADVANCE_DELAY_MS,
  MIN_AUTO_ADVANCE_DELAY_MS,
} from "../more";

const translate = (key: string) => `translated:${key}`;

describe("autoAdvanceDelay", () => {
  it("uses the default for a missing value", () => {
    expect(autoAdvanceDelay(undefined)).toBe(DEFAULT_AUTO_ADVANCE_DELAY_MS);
  });

  it("accepts the range boundaries and a valid step", () => {
    expect(autoAdvanceDelay(String(MIN_AUTO_ADVANCE_DELAY_MS))).toBe(MIN_AUTO_ADVANCE_DELAY_MS);
    expect(autoAdvanceDelay(String(MIN_AUTO_ADVANCE_DELAY_MS + AUTO_ADVANCE_DELAY_STEP_MS))).toBe(
      MIN_AUTO_ADVANCE_DELAY_MS + AUTO_ADVANCE_DELAY_STEP_MS
    );
    expect(autoAdvanceDelay(String(MAX_AUTO_ADVANCE_DELAY_MS))).toBe(MAX_AUTO_ADVANCE_DELAY_MS);
  });

  it.each(["749", "1100", "3001", "1125.5", "not-a-number"])(
    "falls back for an invalid value: %s",
    (value) => {
      expect(autoAdvanceDelay(value)).toBe(DEFAULT_AUTO_ADVANCE_DELAY_MS);
    }
  );
});

describe("buildMoreMedalItems", () => {
  it("builds ordered locked milestone and achievement items", () => {
    const items = buildMoreMedalItems({ medals: [], locale: "he", translate });

    expect(items.map((item) => item.slug)).toEqual([
      "streak-3",
      "streak-7",
      "streak-30",
      "first-topic",
      "all-topics",
      "exam-pass",
    ]);
    expect(items.map((item) => item.icon)).toEqual([
      "flame",
      "star",
      "trophy",
      "check",
      "globe",
      "timer",
    ]);
    expect(items.every((item) => !item.earned)).toBe(true);
    expect(items.map((item) => item.dateText)).toEqual(
      Array.from({ length: 6 }, () => "translated:medalLockedLabel")
    );
  });

  it.each([
    ["he", "he-IL"],
    ["ar", "ar-IL"],
  ])("formats earned dates using %s page locale", (locale, dateLocale) => {
    const earnedAt = "2026-01-15T10:00:00Z";
    const items = buildMoreMedalItems({
      medals: [
        { medal_slug: "streak-3", earned_at: earnedAt },
        { medal_slug: "exam-pass", earned_at: earnedAt },
      ],
      locale,
      translate,
    });
    const expectedDate = new Intl.DateTimeFormat(dateLocale, {
      day: "numeric",
      month: "short",
    }).format(new Date(earnedAt));

    expect(items[0]).toMatchObject({
      slug: "streak-3",
      label: "translated:milestone3",
      earned: true,
      dateText: expectedDate,
    });
    expect(items[5]).toMatchObject({
      slug: "exam-pass",
      label: "translated:achExamPass",
      earned: true,
      dateText: expectedDate,
    });
    expect(items[1].dateText).toBe("translated:medalLockedLabel");
  });
});
