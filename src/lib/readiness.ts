import { EXAM_PASS_MARK } from "./exam";
import type { ExamAttempt, TopicAccuracy } from "./db";

export type ReadinessLevel = "low" | "medium" | "high";

export type Readiness =
  | { level: ReadinessLevel; probability: number; attemptsUsed: number }
  | { level: null; probability: null; attemptsUsed: 0 };

/** How many recent mock-exam attempts feed the estimate. */
export const READINESS_MAX_ATTEMPTS = 5;

/** Per-step decay for the recency weighting (newest attempt weighs 1). */
const RECENCY_DECAY = 0.6;

/** Logistic steepness: how many score points move the estimate meaningfully. */
const LOGISTIC_SCALE = 2;

const PROBABILITY_FLOOR = 0.05;
const PROBABILITY_CEIL = 0.95;

const HIGH_THRESHOLD = 0.75;
const MEDIUM_THRESHOLD = 0.45;

/**
 * Projected pass probability from recent mock-exam history.
 *
 * Recency-weighted mean of the last few attempt scores, mapped through a
 * logistic centered just below the pass mark. Deliberately single-sourced
 * from mock exams (practice-quiz accuracy measures something else); blending
 * the two is a possible future refinement.
 */
export function computeReadiness(attempts: ExamAttempt[]): Readiness {
  if (attempts.length === 0) {
    return { level: null, probability: null, attemptsUsed: 0 };
  }

  const recent = [...attempts]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, READINESS_MAX_ATTEMPTS);

  let weightedSum = 0;
  let weightTotal = 0;
  recent.forEach((attempt, i) => {
    const weight = RECENCY_DECAY ** i;
    weightedSum += weight * attempt.score;
    weightTotal += weight;
  });
  const meanScore = weightedSum / weightTotal;

  const margin = meanScore - (EXAM_PASS_MARK - 0.5);
  const raw = 1 / (1 + Math.exp(-margin / LOGISTIC_SCALE));
  const probability = Math.min(PROBABILITY_CEIL, Math.max(PROBABILITY_FLOOR, raw));

  const level: ReadinessLevel =
    probability >= HIGH_THRESHOLD
      ? "high"
      : probability >= MEDIUM_THRESHOLD
      ? "medium"
      : "low";

  return { level, probability, attemptsUsed: recent.length };
}

export type WeakTopic = {
  topic_id: string;
  /** 0..1 share of the topic's answered questions that are currently correct. */
  accuracy: number;
  total: number;
};

/** Fewer answers than this is too noisy to call a topic weak. */
export const WEAK_TOPIC_MIN_ANSWERS = 5;

/** At or above this accuracy a topic counts as mastered, not weak. */
export const WEAK_TOPIC_MAX_ACCURACY = 0.85;

/** Shared core of the weak/strong pickers: topics with enough answers,
 *  filtered by the mastery bar and ranked by accuracy in the given
 *  direction (ties: more answers first, then topic_id). */
function rankTopicsByAccuracy(
  rows: TopicAccuracy[],
  limit: number,
  mastered: boolean
): WeakTopic[] {
  const direction = mastered ? -1 : 1;
  return rows
    .filter((row) => row.total >= WEAK_TOPIC_MIN_ANSWERS)
    .map((row) => ({
      topic_id: row.topic_id,
      accuracy: row.correct / row.total,
      total: row.total,
    }))
    .filter((row) => (row.accuracy >= WEAK_TOPIC_MAX_ACCURACY) === mastered)
    .sort(
      (a, b) =>
        direction * (a.accuracy - b.accuracy) ||
        b.total - a.total ||
        a.topic_id.localeCompare(b.topic_id)
    )
    .slice(0, limit);
}

export function findWeakestTopics(
  rows: TopicAccuracy[],
  limit = 3
): WeakTopic[] {
  return rankTopicsByAccuracy(rows, limit, false);
}

/** Exact inverse of findWeakestTopics: topics with enough answers whose
 *  accuracy clears the mastery bar, strongest first. */
export function findStrongestTopics(
  rows: TopicAccuracy[],
  limit = 3
): WeakTopic[] {
  return rankTopicsByAccuracy(rows, limit, true);
}
