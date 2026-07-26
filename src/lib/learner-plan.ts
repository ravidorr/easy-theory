import type { TopicAccuracy } from "./db";

export type ReadinessConfidence = "low" | "medium" | "high";

export function readinessConfidence(examAttempts: number, answeredQuestions: number): ReadinessConfidence {
  const evidence = examAttempts * 30 + answeredQuestions;
  if (evidence >= 120 && examAttempts >= 3) return "high";
  if (evidence >= 45 || examAttempts >= 1) return "medium";
  return "low";
}

export function recommendedTopicIds(
  topics: TopicAccuracy[],
  questionCounts: Record<string, number>,
  limit = 3
): string[] {
  return [...topics]
    .map((topic) => ({
      id: topic.topic_id,
      score: (topic.correct / Math.max(topic.total, 1)) + topic.total / Math.max(questionCounts[topic.topic_id] ?? 1, 1),
    }))
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((topic) => topic.id);
}
