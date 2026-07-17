import type { TopicAccuracy } from "@/lib/db";
import { POINTS_PER_CORRECT } from "@/lib/quiz";

/** Practice questions per Asia/Jerusalem day that count as a met daily goal. */
export const DAILY_GOAL_QUESTIONS = 20;

/** Answered-question count that earns the questions achievement. */
export const QUESTIONS_ACHIEVEMENT_TARGET = 100;

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

export type AchievementSlug =
  | "first-topic"
  | "questions-100"
  | "all-topics"
  | "exam-pass";

export type Achievement = {
  slug: AchievementSlug;
  earned: boolean;
};

/**
 * Display-only achievements derived from already-persisted progress. Unlike
 * streak medals these are recomputed on every render, so they need no storage
 * and always reflect the current data; the flip side is that they are not
 * sticky (growing the topic bank can un-earn all-topics until the new topic
 * is completed). Persisting earn events in user_medals is the follow-up.
 */
export function deriveAchievements(input: {
  completedTopicCount: number;
  totalTopicCount: number;
  questionsAnswered: number;
  hasPassedExam: boolean;
}): Achievement[] {
  return [
    { slug: "first-topic", earned: input.completedTopicCount >= 1 },
    {
      slug: "questions-100",
      earned: input.questionsAnswered >= QUESTIONS_ACHIEVEMENT_TARGET,
    },
    {
      slug: "all-topics",
      earned:
        input.totalTopicCount > 0 &&
        input.completedTopicCount >= input.totalTopicCount,
    },
    { slug: "exam-pass", earned: input.hasPassedExam },
  ];
}
