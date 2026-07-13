// Mock exam (סימולציית מבחן תיאוריה) — mirrors the real Israeli theory test format.
export const EXAM_QUESTION_COUNT = 30;
export const EXAM_DURATION_SECONDS = 40 * 60;
export const EXAM_PASS_MARK = 26;

export type ExamAnswer = {
  question_id: string;
  selected_option: string;
};

export type ExamAnswerResult = {
  question_id: string;
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
};

const OPTIONS = ["a", "b", "c", "d"];

/** Fisher–Yates shuffle. Returns a new array; `rng` is injectable for tests. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Random sample of `count` ids (all of them when fewer exist). */
export function sampleIds(
  ids: string[],
  count: number,
  rng: () => number = Math.random
): string[] {
  return shuffle(ids, rng).slice(0, count);
}

/**
 * Score submitted answers against the correct options.
 * Duplicate answers for a question keep the last one; unknown questions and
 * invalid options count as wrong.
 */
export function scoreExam(
  answers: ExamAnswer[],
  correctById: Map<string, string>
): { score: number; results: ExamAnswerResult[] } {
  const deduped = new Map<string, string>();
  for (const answer of answers) {
    if (correctById.has(answer.question_id)) {
      deduped.set(answer.question_id, answer.selected_option);
    }
  }

  let score = 0;
  const results: ExamAnswerResult[] = [];
  for (const [questionId, selected] of deduped) {
    const correct = correctById.get(questionId)!;
    const isCorrect = OPTIONS.includes(selected) && selected === correct;
    if (isCorrect) score++;
    results.push({
      question_id: questionId,
      selected_option: selected,
      correct_option: correct,
      is_correct: isCorrect,
    });
  }
  return { score, results };
}
