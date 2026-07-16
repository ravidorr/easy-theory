import type { TopicProgress } from "./db";
import { POINTS_PER_CORRECT } from "./quiz";
import { coveragePercent } from "./gamification";
import { estimateMinutesRemaining } from "./personalization";

export type TopicDifficulty = "easy" | "medium" | "hard";

/** Editorial per-topic difficulty. Kept code-side on purpose: four static
 *  topics and no admin UI; promote to a topics column only if editors ever
 *  need to change it per environment. */
export const TOPIC_DIFFICULTY_BY_SLUG: Record<string, TopicDifficulty> = {
  signs: "easy",
  safety: "medium",
  vehicle: "medium",
  "traffic-laws": "hard",
};

export type TopicDuration = { unit: "minutes" | "hours"; value: number };

/** Remaining practice time at the shared pace, in a display-friendly unit:
 *  whole minutes under an hour, rounded hours from there. */
export function topicDuration(remainingQuestions: number): TopicDuration | null {
  if (remainingQuestions <= 0) return null;
  const minutes = estimateMinutesRemaining(remainingQuestions);
  if (minutes < 60) return { unit: "minutes", value: minutes };
  return { unit: "hours", value: Math.max(1, Math.round(minutes / 60)) };
}

export type TopicCardMeta = {
  done: boolean;
  answered: number;
  total: number;
  coveragePct: number;
  barPct: number;
  bestScore: number | null;
  difficulty: TopicDifficulty | null;
  duration: TopicDuration | null;
  remainingPoints: number;
};

export function buildTopicCardMeta(input: {
  slug: string;
  totalQuestions: number;
  answeredQuestions: number;
  progress: Pick<TopicProgress, "status" | "best_score"> | undefined;
}): TopicCardMeta {
  const total = Math.max(0, input.totalQuestions);
  const answered = Math.min(Math.max(0, input.answeredQuestions), total);
  const done = input.progress?.status === "completed";
  const coveragePct = coveragePercent(answered, total);
  const bestScore = input.progress?.best_score ?? null;
  // Completed topics keep showing the quiz score; in-progress ones show
  // coverage so the card moves with every answered question.
  const barPct = done ? bestScore ?? 0 : coveragePct;
  const remainingQuestions = done ? 0 : total - answered;
  return {
    done,
    answered,
    total,
    coveragePct,
    barPct,
    bestScore,
    difficulty: TOPIC_DIFFICULTY_BY_SLUG[input.slug] ?? null,
    duration: topicDuration(remainingQuestions),
    remainingPoints: remainingQuestions * POINTS_PER_CORRECT,
  };
}
