import type { QuestionRef, TopicProgress, WindowAccuracy } from "./db";
import type { ReadinessLevel, WeakTopic } from "./readiness";

/** Matches the streak day-boundary logic in the submit_quiz_answer RPC. */
export const APP_TIME_ZONE = "Asia/Jerusalem";

/** Practice pace: ~40 seconds per question with instant feedback (the mock
 *  exam budgets 30 questions in 40 minutes; practice moves faster). */
export const PRACTICE_QUESTIONS_PER_MINUTE = 1.5;

/** Below this share of correct answers, yesterday's summary encourages
 *  improvement instead of celebrating. */
export const GOOD_ACCURACY_THRESHOLD = 0.8;

const DAY_MS = 24 * 60 * 60 * 1000;

export function estimateMinutesRemaining(remaining: number): number {
  return Math.max(1, Math.round(remaining / PRACTICE_QUESTIONS_PER_MINUTE));
}

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

export function pickLastStudiedInProgressTopic(
  rows: TopicProgress[]
): TopicProgress | null {
  let best: TopicProgress | null = null;
  for (const row of rows) {
    if (row.status !== "in_progress") continue;
    if (
      !best ||
      (row.last_studied_at ?? "") > (best.last_studied_at ?? "")
    ) {
      best = row;
    }
  }
  return best;
}

export type ResumePoint = {
  questionNumber: number;
  remaining: number;
};

/** Questions must already be ordered by question_number (as the db helper returns them). */
export function findResumePoint(
  questions: QuestionRef[],
  answeredIds: Set<string>
): ResumePoint | null {
  let first: QuestionRef | null = null;
  let remaining = 0;
  for (const question of questions) {
    if (answeredIds.has(question.id)) continue;
    remaining += 1;
    first ??= question;
  }
  return first ? { questionNumber: first.question_number, remaining } : null;
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

export function selectFocusTopic(
  weakTopics: WeakTopic[],
  excludeTopicId?: string | null
): WeakTopic | null {
  if (weakTopics.length === 0) return null;
  return (
    weakTopics.find((topic) => topic.topic_id !== excludeTopicId) ??
    weakTopics[0]
  );
}

export type PersonalizedLine =
  | { kind: "resume"; topicId: string; questionNumber: number; minutes: number }
  | { kind: "yesterday"; percent: number; good: boolean }
  | { kind: "focus"; topicId: string }
  | { kind: "mastered"; topicId: string }
  | { kind: "remaining"; count: number }
  | { kind: "examReady" };

const MAX_GREETING_LINES = 2;

/** Below this overall coverage, "only N questions left" reads as a mountain,
 *  not a finish line, so the line stays hidden. */
export const REMAINING_LINE_MIN_PERCENT = 50;

/**
 * Chooses up to two personalized greeting lines. The resume line always leads
 * when available; the remaining slot rotates daily (by APP_TIME_ZONE day
 * index) through the coach lines that apply - exam readiness, yesterday's
 * accuracy, the focus-topic suggestion, a mastered-topic celebration, and the
 * questions-left countdown - so the homepage reads differently between visits
 * without being random.
 */
export function buildGreetingContext(input: {
  resume: (ResumePoint & { topicId: string }) | null;
  yesterday: WindowAccuracy | null;
  focusTopicId: string | null;
  masteredTopicId: string | null;
  remaining: { count: number; percent: number } | null;
  readinessLevel: ReadinessLevel | null;
  /** When the exam card is surfaced just below the greeting, the exam-ready
   *  line would duplicate it, so it yields its rotation slot. */
  examCardSurfaced?: boolean;
  now: Date;
}): PersonalizedLine[] {
  const lines: PersonalizedLine[] = [];

  if (input.resume) {
    lines.push({
      kind: "resume",
      topicId: input.resume.topicId,
      questionNumber: input.resume.questionNumber,
      minutes: estimateMinutesRemaining(input.resume.remaining),
    });
  }

  const rotating: PersonalizedLine[] = [];
  if (input.readinessLevel === "high" && !input.examCardSurfaced) {
    rotating.push({ kind: "examReady" });
  }
  if (input.yesterday && input.yesterday.total > 0) {
    const accuracy = input.yesterday.correct / input.yesterday.total;
    rotating.push({
      kind: "yesterday",
      percent: Math.round(accuracy * 100),
      good: accuracy >= GOOD_ACCURACY_THRESHOLD,
    });
  }
  // A focus or mastered line pointing at the topic the resume line already
  // links to would just repeat it.
  const topicLines = [
    { kind: "focus", topicId: input.focusTopicId },
    { kind: "mastered", topicId: input.masteredTopicId },
  ] as const;
  for (const { kind, topicId } of topicLines) {
    if (topicId && topicId !== input.resume?.topicId) {
      rotating.push({ kind, topicId });
    }
  }
  if (
    input.remaining &&
    input.remaining.count > 0 &&
    input.remaining.percent >= REMAINING_LINE_MIN_PERCENT
  ) {
    rotating.push({ kind: "remaining", count: input.remaining.count });
  }

  // Rotate by the zone's wall-date day number so the greeting reads
  // differently between visits; the offset-corrected midnight is deliberately
  // not involved (a plain calendar-day counter is all rotation needs).
  const today = zonedParts(input.now);
  const dayIndex = Math.floor(Date.UTC(today.y, today.m - 1, today.d) / DAY_MS);
  if (rotating.length > 1) {
    rotating.push(...rotating.splice(0, dayIndex % rotating.length));
  }

  return [...lines, ...rotating].slice(0, MAX_GREETING_LINES);
}
