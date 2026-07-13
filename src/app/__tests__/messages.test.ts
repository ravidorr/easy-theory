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

  it("keeps the ICU placeholders of the daily task description in both locales", () => {
    expect(he.Home.todayTaskDesc).toContain("{count}");
    expect(ar.Home.todayTaskDesc).toContain("{count}");
  });

  it("keeps the ICU placeholders of the topic answered-count label in both locales", () => {
    for (const messages of [he, ar]) {
      expect(messages.Home.topicAnsweredCount).toContain("{answered}");
      expect(messages.Home.topicAnsweredCount).toContain("{total}");
    }
  });
});
