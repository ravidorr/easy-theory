import { describe, it, expect } from "vitest";
import { INITIAL_SRS_STATE, isDue, reviewCard } from "../srs";
import type { SrsState } from "../srs";

const NOW = new Date("2026-07-14T10:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * DAY_MS).toISOString();
}

describe("reviewCard", () => {
  it("schedules a new card 1 day out on the first pass", () => {
    const review = reviewCard(INITIAL_SRS_STATE, true, NOW);
    expect(review).toEqual({
      ease: 2.5,
      interval_days: 1,
      repetitions: 1,
      due_at: daysFromNow(1),
      last_reviewed_at: NOW.toISOString(),
    });
  });

  it("walks the pass ladder 1d, 6d, then round(interval * ease)", () => {
    const first = reviewCard(INITIAL_SRS_STATE, true, NOW);
    const second = reviewCard(first, true, NOW);
    const third = reviewCard(second, true, NOW);

    expect(second.interval_days).toBe(6);
    expect(second.due_at).toBe(daysFromNow(6));
    // round(6 * 2.5) = 15
    expect(third.interval_days).toBe(15);
    expect(third.repetitions).toBe(3);
    expect(third.due_at).toBe(daysFromNow(15));
  });

  it("keeps ease unchanged on a pass", () => {
    const state: SrsState = { ease: 1.9, interval_days: 6, repetitions: 2 };
    expect(reviewCard(state, true, NOW).ease).toBe(1.9);
  });

  it("resets repetitions and interval on a fail and makes the card due now", () => {
    const state: SrsState = { ease: 2.5, interval_days: 15, repetitions: 3 };
    const review = reviewCard(state, false, NOW);
    expect(review).toEqual({
      ease: 2.3,
      interval_days: 0,
      repetitions: 0,
      due_at: NOW.toISOString(),
      last_reviewed_at: NOW.toISOString(),
    });
  });

  it("never drops ease below the 1.3 floor", () => {
    const state: SrsState = { ease: 1.4, interval_days: 1, repetitions: 1 };
    expect(reviewCard(state, false, NOW).ease).toBe(1.3);
    expect(reviewCard({ ...state, ease: 1.3 }, false, NOW).ease).toBe(1.3);
  });

  it("relearns a lapsed card from the start of the ladder", () => {
    const lapsed = reviewCard({ ease: 2.5, interval_days: 15, repetitions: 3 }, false, NOW);
    const relearned = reviewCard(lapsed, true, NOW);
    expect(relearned.repetitions).toBe(1);
    expect(relearned.interval_days).toBe(1);
    expect(relearned.ease).toBe(2.3);
  });
});

describe("isDue", () => {
  it("treats an unscheduled card (null/undefined) as due", () => {
    expect(isDue(null, NOW)).toBe(true);
    expect(isDue(undefined, NOW)).toBe(true);
  });

  it("returns true for past and exactly-now due dates", () => {
    expect(isDue(daysFromNow(-1), NOW)).toBe(true);
    expect(isDue(NOW.toISOString(), NOW)).toBe(true);
  });

  it("returns false for future due dates", () => {
    expect(isDue(daysFromNow(1), NOW)).toBe(false);
  });

  it("treats an unparseable due date as due", () => {
    expect(isDue("not-a-date", NOW)).toBe(true);
  });
});
