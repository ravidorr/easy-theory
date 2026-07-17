import { describe, it, expect } from "vitest";
import he from "../../../messages/he.json";
import ar from "../../../messages/ar.json";
import { STREAK_MILESTONES } from "@/lib/quiz";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("locale messages", () => {
  it("he and ar define exactly the same keys", () => {
    expect(flattenKeys(ar).sort()).toEqual(flattenKeys(he).sort());
  });

  it("keeps the ICU placeholders of the daily task description in both locales", () => {
    expect(he.Home.todayTaskDesc).toContain("{count}");
    expect(ar.Home.todayTaskDesc).toContain("{count}");
  });

  it("keeps the ICU placeholders of the topic answered-count label in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.topicAnsweredCountPct).toContain("{answered}");
      expect(messages.Home.topicAnsweredCountPct).toContain("{total}");
      expect(messages.Home.topicAnsweredCountPct).toContain("{percent}");
    }
  });

  it("keeps the ICU placeholders of the overall progress strings in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.topicsPercent).toContain("{percent}");
      expect(messages.Home.topicsAnsweredOverall).toContain("{answered}");
      expect(messages.Home.topicsAnsweredOverall).toContain("{total}");
      expect(messages.Home.topicsRemaining).toContain("{count}");
      expect(messages.Home.topicsRemainingOne).toBeTruthy();
    }
  });

  it("keeps the ICU placeholders of the personalized greeting strings in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.resumeLine).toContain("{number}");
      expect(messages.Home.resumeLine).toContain("{minutes}");
      expect(messages.Home.resumeLineOneMinute).toContain("{number}");
      expect(messages.Home.yesterdayAccuracyHigh).toContain("{percent}");
      expect(messages.Home.yesterdayAccuracyLow).toContain("{percent}");
      expect(messages.Home.focusTopicLine).toContain("{topic}");
      expect(messages.Home.masteredTopicLine).toContain("{topic}");
      expect(messages.Home.remainingQuestionsLine).toContain("{count}");
      expect(messages.Home.remainingQuestionsLineOne).toBeTruthy();
      expect(messages.Home.examReadyLine).toBeTruthy();
    }
  });

  it("keeps the ICU placeholders of the medal nudge strings in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.daysToMedalOne).toContain("{medal}");
      expect(messages.Home.daysToMedalMany).toContain("{count, plural,");
      expect(messages.Home.daysToMedalMany).toContain("{medal}");
      expect(messages.Home.daysToMedalStart).toContain("{count}");
    }
  });

  it("defines a medal name for every streak milestone in both locales", () => {
    for (const messages of [he, ar]) {
      const home = messages.Home as Record<string, string>;
      for (const milestone of STREAK_MILESTONES) {
        expect(home[`medalName${milestone}`]).toBeTruthy();
      }
    }
  });
});
