import type { TopicProgress } from "./db";

/** Matches the streak day-boundary logic in the submit_quiz_answer RPC. */
export const APP_TIME_ZONE = "Asia/Jerusalem";

// One reusable formatter: Intl.DateTimeFormat construction is expensive and
// this module converts several instants per render.
const ZONED_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function zonedParts(instant: Date): {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
} {
  const parts = ZONED_FORMAT.formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    min: get("minute"),
  };
}

/** The zone's UTC offset (ms) at the given instant. */
function zoneOffsetMs(utcMs: number): number {
  const p = zonedParts(new Date(utcMs));
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - utcMs;
}

/**
 * UTC instant of local midnight in APP_TIME_ZONE for the given wall date.
 * Date.UTC normalizes overflow, so `d` may be out of range (0, negative, 32).
 */
function zonedMidnightUtc(y: number, m: number, d: number): number {
  const wallUtc = Date.UTC(y, m - 1, d);
  // Two-pass offset correction: the offset sampled at the naive guess is wrong
  // on a DST-transition day (the guess lands after the 02:00 switch while true
  // midnight is before it), so resample at the corrected instant. Israel's
  // transitions happen at 02:00, so local midnight always exists exactly once.
  const guess = wallUtc - zoneOffsetMs(wallUtc);
  return wallUtc - zoneOffsetMs(guess);
}

/**
 * Half-open UTC window [from, to) covering the APP_TIME_ZONE calendar day
 * `daysBack` days before `now` (daysBack = 1 is yesterday).
 */
export function dayWindow(
  now: Date,
  daysBack: number
): { fromIso: string; toIso: string } {
  const today = zonedParts(now);
  return {
    fromIso: new Date(
      zonedMidnightUtc(today.y, today.m, today.d - daysBack)
    ).toISOString(),
    toIso: new Date(
      zonedMidnightUtc(today.y, today.m, today.d - daysBack + 1)
    ).toISOString(),
  };
}

/** Picks the lesson to suggest after finishing a topic: the first other
 *  topic still in progress, else the first untouched one. Completed topics
 *  are skipped, which also makes this the right helper for the mission
 *  picker once it stops recommending finished topics. */
export function selectNextTopic<T extends { id: string }>(
  topics: T[],
  progressByTopicId: Record<string, Pick<TopicProgress, "status"> | undefined>,
  excludeTopicId?: string | null,
  isEligible: (topic: T) => boolean = () => true
): T | null {
  const candidates = topics.filter(
    (topic) => topic.id !== excludeTopicId && isEligible(topic)
  );
  return (
    candidates.find(
      (topic) => progressByTopicId[topic.id]?.status === "in_progress"
    ) ??
    candidates.find((topic) => {
      const status = progressByTopicId[topic.id]?.status;
      return status === undefined || status === "not_started";
    }) ??
    null
  );
}
