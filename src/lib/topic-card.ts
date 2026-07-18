import type { TopicProgress } from "./db";
import { coveragePercent } from "./gamification";

export type TopicCardMeta = {
  done: boolean;
  answered: number;
  total: number;
  coveragePct: number;
  barPct: number;
  bestScore: number | null;
};

export function buildTopicCardMeta(input: {
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
  return {
    done,
    answered,
    total,
    coveragePct,
    barPct,
    bestScore,
  };
}
