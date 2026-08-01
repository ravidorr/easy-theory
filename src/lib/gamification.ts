import type { TopicAccuracy } from "@/lib/db";
import { POINTS_PER_CORRECT } from "@/lib/quiz";

/** Practice questions per Asia/Jerusalem day that count as a met daily goal. */
export const DAILY_GOAL_QUESTIONS = 20;

// Tied to the points scale so rebalancing POINTS_PER_CORRECT keeps the same
// level pacing: with 6 first-correct answers per curve unit, the full
// 1,273-question bank spans roughly 15 levels. Exported so pages can hand the
// unit to public/js/stats-pills.js via a data attribute. The curve *formula*
// is mirrored in that script (it cannot import TS); a parity test in
// stats-pills-script.test.ts fails if the two implementations drift.
export const LEVEL_CURVE_UNIT = 6 * POINTS_PER_CORRECT;

/**
 * Cumulative star points needed to reach a level. Quadratic so early levels
 * arrive quickly.
 */
export function pointsToReachLevel(level: number): number {
  return LEVEL_CURVE_UNIT * (level - 1) * level;
}

export type LevelInfo = {
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  /** Progress toward the next level, always in [0, 1) by construction. */
  progress: number;
};

export function levelForPoints(points: number): LevelInfo {
  const safePoints = Math.max(0, Math.floor(points));
  let level = 1;
  while (pointsToReachLevel(level + 1) <= safePoints) level += 1;
  const levelBase = pointsToReachLevel(level);
  const pointsForNextLevel = pointsToReachLevel(level + 1) - levelBase;
  const pointsIntoLevel = safePoints - levelBase;
  return {
    level,
    pointsIntoLevel,
    pointsForNextLevel,
    progress: pointsIntoLevel / pointsForNextLevel,
  };
}

export type CompletionSummary = {
  totalQuestions: number;
  answeredQuestions: number;
  remainingQuestions: number;
  /** Whole percent, floored and capped: never 100 while questions remain. */
  percent: number;
};

/**
 * Overall coverage across the listed topics, from the same per-topic count
 * maps the topic cards use. Shared by the homepage and the More stats grid so
 * both always report the same completion percent.
 */
export function completionSummary(
  topicIds: string[],
  questionCounts: Record<string, number>,
  answeredCounts: Record<string, number>
): CompletionSummary {
  let totalQuestions = 0;
  let answeredQuestions = 0;
  for (const id of topicIds) {
    totalQuestions += questionCounts[id] ?? 0;
    answeredQuestions += answeredCounts[id] ?? 0;
  }
  const percent = coveragePercent(answeredQuestions, totalQuestions);
  return {
    totalQuestions,
    answeredQuestions,
    remainingQuestions: Math.max(totalQuestions - answeredQuestions, 0),
    percent,
  };
}

/**
 * Share of answered questions as a whole percent. Floor, not round: a bar or
 * label must not show 100% while questions remain. Shared by the overall
 * completion summary and the per-topic cards so they can never disagree.
 */
export function coveragePercent(answered: number, total: number): number {
  return total > 0 ? Math.min(100, Math.floor((answered / total) * 100)) : 0;
}

/**
 * Whole-percent accuracy across all answered questions, or null when nothing
 * has been answered yet so the UI can show an empty state instead of a fake 0.
 */
export function overallAccuracy(rows: TopicAccuracy[]): number | null {
  let correct = 0;
  let total = 0;
  for (const row of rows) {
    correct += row.correct;
    total += row.total;
  }
  if (total === 0) return null;
  return Math.round((correct / total) * 100);
}
