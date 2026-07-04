import { describe, it, expect } from "vitest";
import {
  computeNewStreak,
  isMilestoneReached,
  STREAK_MILESTONES,
} from "../quiz";

describe("computeNewStreak", () => {
  const TODAY = "2026-07-04";
  const YESTERDAY = "2026-07-03";
  const OLDER = "2026-06-01";

  it("returns current streak unchanged when already active today", () => {
    expect(computeNewStreak(5, TODAY, TODAY, YESTERDAY)).toBe(5);
  });

  it("increments streak by 1 when last active yesterday", () => {
    expect(computeNewStreak(5, YESTERDAY, TODAY, YESTERDAY)).toBe(6);
  });

  it("resets streak to 1 when last active before yesterday", () => {
    expect(computeNewStreak(10, OLDER, TODAY, YESTERDAY)).toBe(1);
  });

  it("resets streak to 1 when last active date is null (first time ever)", () => {
    expect(computeNewStreak(0, null, TODAY, YESTERDAY)).toBe(1);
  });
});

describe("isMilestoneReached", () => {
  it("returns true when streak hits a milestone for the first time", () => {
    expect(isMilestoneReached(3, 2, STREAK_MILESTONES)).toBe(true);
    expect(isMilestoneReached(7, 6, STREAK_MILESTONES)).toBe(true);
    expect(isMilestoneReached(14, 13, STREAK_MILESTONES)).toBe(true);
    expect(isMilestoneReached(30, 29, STREAK_MILESTONES)).toBe(true);
  });

  it("returns false when streak did not change (same day)", () => {
    expect(isMilestoneReached(7, 7, STREAK_MILESTONES)).toBe(false);
  });

  it("returns false when new streak is not a milestone", () => {
    expect(isMilestoneReached(5, 4, STREAK_MILESTONES)).toBe(false);
  });

  it("returns false when streak resets to 1 (1 is not a milestone)", () => {
    expect(isMilestoneReached(1, 15, STREAK_MILESTONES)).toBe(false);
  });
});
