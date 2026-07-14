/** Binary SM-2 spaced repetition.
 * A pass is treated as SM-2 quality 4 (ease delta exactly 0), a fail as a
 * lapse: repetitions reset and the card becomes due immediately.
 */

export type SrsState = {
  ease: number;
  interval_days: number;
  repetitions: number;
};

export type SrsReview = SrsState & {
  due_at: string;
  last_reviewed_at: string;
};

export const INITIAL_SRS_STATE: SrsState = {
  ease: 2.5,
  interval_days: 0,
  repetitions: 0,
};

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function reviewCard(state: SrsState, correct: boolean, now: Date = new Date()): SrsReview {
  const nowIso = now.toISOString();

  if (!correct) {
    return {
      ease: Math.max(MIN_EASE, state.ease - 0.2),
      interval_days: 0,
      repetitions: 0,
      due_at: nowIso,
      last_reviewed_at: nowIso,
    };
  }

  const repetitions = state.repetitions + 1;
  const interval_days =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.interval_days * state.ease);

  return {
    ease: state.ease,
    interval_days,
    repetitions,
    due_at: new Date(now.getTime() + interval_days * DAY_MS).toISOString(),
    last_reviewed_at: nowIso,
  };
}

/** A card with no schedule yet (null/undefined due_at) counts as due. */
export function isDue(dueAt: string | null | undefined, now: Date = new Date()): boolean {
  if (dueAt == null) return true;
  const due = Date.parse(dueAt);
  return Number.isNaN(due) ? true : due <= now.getTime();
}
