import { describe, expect, it } from "vitest";
import { shouldSuppressQuestionImage } from "@/lib/question-image";

describe("shouldSuppressQuestionImage", () => {
  it("suppresses a sign image that exactly matches the correct answer", () => {
    expect(
      shouldSuppressQuestionImage("/signs/sign-123.png", "a", [["a", "123"], ["b", "301"]]),
    ).toBe(true);
  });

  it("renders a prompt sign that does not match the correct answer", () => {
    expect(
      shouldSuppressQuestionImage("/signs/sign-126.png", "a", [["a", "123"], ["b", "301"]]),
    ).toBe(false);
  });

  it("renders a prompt sign that only matches an incorrect option", () => {
    expect(
      shouldSuppressQuestionImage("/signs/sign-999.png", "a", [["a", "101"], ["b", "999"]]),
    ).toBe(false);
  });

  it("trims option whitespace before comparing", () => {
    expect(shouldSuppressQuestionImage("/signs/sign-303.svg", "a", [["a", " 303 "]])).toBe(true);
  });

  it("does not suppress missing or non-sign images", () => {
    expect(shouldSuppressQuestionImage(null, "a", [["a", "123"]])).toBe(false);
    expect(shouldSuppressQuestionImage(undefined, "a", [["a", "123"]])).toBe(false);
    expect(shouldSuppressQuestionImage("/questions/3123.jpg", "a", [["a", "123"]])).toBe(false);
  });
});
