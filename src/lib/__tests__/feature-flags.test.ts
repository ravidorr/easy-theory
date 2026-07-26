import { afterEach, describe, expect, it } from "vitest";
import { featureEnabled } from "../feature-flags";

const keys = [
  "FEATURE_EXAM_SESSIONS_PERCENT",
  "FEATURE_GUEST_DIAGNOSTIC_PERCENT",
  "FEATURE_PERSONALIZED_PLAN_PERCENT",
  "FEATURE_CORE_NAVIGATION_PERCENT",
] as const;

afterEach(() => {
  for (const key of keys) delete process.env[key];
});

describe("featureEnabled", () => {
  it("uses the enabled defaults", () => {
    expect(featureEnabled("exam_sessions", "learner-1")).toBe(true);
  });

  it("handles invalid, disabled, and fully enabled rollouts", () => {
    process.env.FEATURE_GUEST_DIAGNOSTIC_PERCENT = "invalid";
    expect(featureEnabled("guest_diagnostic", "learner-1")).toBe(false);
    process.env.FEATURE_GUEST_DIAGNOSTIC_PERCENT = "0";
    expect(featureEnabled("guest_diagnostic", "learner-1")).toBe(false);
    process.env.FEATURE_GUEST_DIAGNOSTIC_PERCENT = "100";
    expect(featureEnabled("guest_diagnostic", "learner-1")).toBe(true);
  });

  it("uses deterministic bucketing for partial rollouts", () => {
    process.env.FEATURE_PERSONALIZED_PLAN_PERCENT = "50";
    expect(featureEnabled("personalized_plan", "learner-1")).toBe(
      featureEnabled("personalized_plan", "learner-1")
    );
  });
});
