import { describe, it, expect } from "vitest";
import he from "../../../messages/he.json";
import ar from "../../../messages/ar.json";

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

  it("keeps duplicate quiz feedback copy aligned with the runtime messages", () => {
    for (const messages of [he, ar]) {
      expect(messages.Quiz.rewardTopicDone).toBe(messages.JS.Quiz.rewardTopicDone);
      expect(messages.Quiz.rewardWrongPrefix).toBe(messages.JS.Quiz.rewardWrongPrefix);
      expect(messages.Quiz.rewardWrongSuffix).toBe(messages.JS.Quiz.rewardWrongSuffix);
    }
  });

  it("keeps the ICU placeholders of the daily task description in both locales", () => {
    expect(he.Home.todayTaskDesc).toContain("{count}");
    expect(ar.Home.todayTaskDesc).toContain("{count}");
  });

  it("defines review-mission copy in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.todayReviewTaskDesc).toBeTruthy();
      expect(messages.Home.missionReviewBtn).toBeTruthy();
    }
  });

  it("keeps the ICU placeholders of the daily-progress label in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.dailyProgress).toContain("{answered}");
      expect(messages.Home.dailyProgress).toContain("{goal}");
    }
  });

  it("keeps progress-ring and readiness values translatable in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.topicsPercent).toContain("{percent}");
      expect(messages.Home.examReadiness).toContain("{percent}");
      expect(messages.Home.examReadiness).toContain("{level}");
    }
  });

  it("defines concise topic states in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.topicCompleted).toBeTruthy();
      expect(messages.Home.topicInProgress).toBeTruthy();
      expect(messages.Home.topicNeedsPractice).toBeTruthy();
      expect(messages.Home.topicNotStarted).toBeTruthy();
    }
  });
});
