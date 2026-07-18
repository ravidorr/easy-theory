import { describe, expect, it } from "vitest";
import { shouldSuppressQuestionImage } from "@/lib/question-image";

describe("shouldSuppressQuestionImage", () => {
  it("suppresses a sign image that exactly matches an answer option", () => {
    expect(
      shouldSuppressQuestionImage("/signs/sign-123.png", ["123", "301", "115", "310"]),
    ).toBe(true);
  });

  it("renders a prompt sign that does not match any answer option", () => {
    expect(
      shouldSuppressQuestionImage("/signs/sign-126.png", ["123", "301", "115", "310"]),
    ).toBe(false);
  });

  it("suppresses a matching option when other options contain text", () => {
    expect(
      shouldSuppressQuestionImage("/signs/sign-999.png", ["101", "999", "103", "all signs"]),
    ).toBe(true);
  });

  it("trims option whitespace before comparing", () => {
    expect(shouldSuppressQuestionImage("/signs/sign-303.svg", [" 303 "])).toBe(true);
  });

  it("does not suppress missing or non-sign images", () => {
    expect(shouldSuppressQuestionImage(null, ["123"])).toBe(false);
    expect(shouldSuppressQuestionImage(undefined, ["123"])).toBe(false);
    expect(shouldSuppressQuestionImage("/questions/3123.jpg", ["123"])).toBe(false);
  });
});
