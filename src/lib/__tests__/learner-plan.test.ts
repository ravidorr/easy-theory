import { describe, expect, it } from "vitest";
import { readinessConfidence } from "../learner-plan";

describe("readinessConfidence", () => {
  it("uses evidence thresholds", () => {
    expect(readinessConfidence(0, 0)).toBe("low");
    expect(readinessConfidence(1, 0)).toBe("medium");
    expect(readinessConfidence(0, 45)).toBe("medium");
    expect(readinessConfidence(3, 30)).toBe("high");
  });
});
