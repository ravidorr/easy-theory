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

  it("defines the localized Easy in theory metadata", () => {
    expect(he.Metadata).toMatchObject({
      rootTitle: "קל בתיאוריה",
      shortName: "קל בתיאוריה",
      tagline: "מנה אחת בכל פעם, בלי להילחץ.",
    });
    expect(ar.Metadata).toMatchObject({
      rootTitle: "سهل في النظرية",
      shortName: "سهل في النظرية",
      tagline: "جرعة واحدة كل مرة، بدون ضغط.",
    });
  });

  it("defines the refreshed localized landing copy", () => {
    expect(he.Login).toMatchObject({
      heroH2: "לימוד לתיאוריה, בלי לחץ.",
      sendBtn: "שלח לי קישור",
      closeCta: "יאללה, נתחיל",
    });
    expect(ar.Login).toMatchObject({
      heroH2: "تعلّموا نظرية القيادة، بدون ضغط.",
      sendBtn: "أرسلوا لي رابطًا",
      closeCta: "هيا لنبدأ",
    });
  });

  it("keeps quiz feedback copy aligned for current and cached runtimes", () => {
    for (const messages of [he, ar]) {
      expect(messages.Quiz.rewardTopicDone).toBe(messages.JS.Quiz.rewardTopicDone);
      expect(messages.Quiz.rewardWrong).toBe(messages.JS.Quiz.rewardWrong);
      expect(messages.Quiz.rewardWrongPrefix).toBe(messages.JS.Quiz.rewardWrongPrefix);
      expect(messages.Quiz.rewardWrongPrefix).toBeTruthy();
      expect(messages.Quiz.rewardWrongSuffix).toBe(messages.JS.Quiz.rewardWrongSuffix);
      expect(messages.Quiz.rewardWrongSuffix).toBeTruthy();
      expect(messages.Quiz.rewardSignSuffix).toBe(messages.JS.Quiz.rewardSignSuffix);
      expect(messages.Quiz.rewardSignSuffix).toBeTruthy();
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
      expect(messages.Home.examReadiness).toContain("{level}");
      expect(messages.Home.examReadiness).toContain("{confidence}");
    }
  });

  it("uses supportive Hebrew copy for readiness-estimate evidence", () => {
    expect(he.Home.examReadiness).toBe("{level} · {confidence}");
    expect(he.Home.readinessConfidenceLow).toBe("המשיכו להתאמן כדי לדייק את התמונה");
    expect(he.Home.readinessConfidenceMedium).toBe("התמונה כבר מתבהרת");
    expect(he.Home.readinessConfidenceHigh).toBe("יש לכם תמונה ברורה להתקדמות");
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
