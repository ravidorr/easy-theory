import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase";
import { getApiTranslator, parseJsonBody } from "@/lib/api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const body = await parseJsonBody(request);
  if (!body || !Array.isArray(body.answers) || body.answers.length !== 12) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }
  const answers = body.answers.filter(
    (answer): answer is { question_id: string; selected_option: "a" | "b" | "c" | "d" } =>
      answer && typeof answer.question_id === "string" && UUID_RE.test(answer.question_id) &&
      typeof answer.selected_option === "string" && /^[a-d]$/.test(answer.selected_option)
  );
  if (answers.length !== 12 || new Set(answers.map((answer) => answer.question_id)).size !== 12) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: questions, error } = await admin
    .from("questions")
    .select("id, topic_id, correct_option")
    .in("id", answers.map((answer) => answer.question_id));
  if (error || (questions ?? []).length !== 12) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }
  const questionById = new Map((questions ?? []).map((question) => [question.id, question]));
  const topicScores: Record<string, { correct: number; total: number }> = {};
  for (const answer of answers) {
    const question = questionById.get(answer.question_id)!;
    const score = topicScores[question.topic_id] ?? { correct: 0, total: 0 };
    score.total += 1;
    if (question.correct_option === answer.selected_option) score.correct += 1;
    topicScores[question.topic_id] = score;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const targetDate = typeof body.target_exam_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.target_exam_date)
      ? body.target_exam_date
      : null;
    const { error: saveError } = await supabase.rpc("complete_diagnostic", {
      p_answers: answers,
      p_topic_scores: topicScores,
      p_target_exam_date: targetDate,
    });
    if (saveError) {
      return NextResponse.json({ error: t("progressSaveFailed") }, { status: 500 });
    }
  }
  return NextResponse.json({ topic_scores: topicScores, saved: Boolean(user) });
}
