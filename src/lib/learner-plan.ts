export type ReadinessConfidence = "low" | "medium" | "high";

export function readinessConfidence(examAttempts: number, answeredQuestions: number): ReadinessConfidence {
  const evidence = examAttempts * 30 + answeredQuestions;
  if (evidence >= 120 && examAttempts >= 3) return "high";
  if (evidence >= 45 || examAttempts >= 1) return "medium";
  return "low";
}
