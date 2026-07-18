import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { EXAM_QUESTION_COUNT, EXAM_PASS_MARK, scoreExam } from "@/lib/exam";
import type { ExamAnswer } from "@/lib/exam";
import { getApiTranslator, parseJsonBody } from "@/lib/api";
import { reportError } from "@/lib/monitoring";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPTION_RE = /^[a-d]$/;

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });
  }

  const allowed = await checkRateLimit(supabase, `exam:${user.id}`, 5, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  const { answers, duration_seconds } = body;
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  const validAnswers: ExamAnswer[] = answers.filter(
    (a): a is ExamAnswer =>
      a != null &&
      typeof a.question_id === "string" &&
      UUID_RE.test(a.question_id) &&
      typeof a.selected_option === "string" &&
      OPTION_RE.test(a.selected_option)
  );

  if (validAnswers.length > EXAM_QUESTION_COUNT) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  let correctById = new Map<string, string>();
  if (validAnswers.length > 0) {
    const { data: questions } = await supabase
      .from("questions")
      .select("id, correct_option")
      .in("id", validAnswers.map((a) => a.question_id));
    correctById = new Map((questions ?? []).map((q) => [q.id, q.correct_option]));
  }

  const { score, results } = scoreExam(validAnswers, correctById);
  const total = EXAM_QUESTION_COUNT;
  const passed = score >= EXAM_PASS_MARK;

  const durationSeconds =
    typeof duration_seconds === "number" && Number.isFinite(duration_seconds)
      ? Math.max(0, Math.round(duration_seconds))
      : null;

  const { error: insertError } = await supabase.from("user_exam_attempts").insert({
    user_id: user.id,
    score,
    total,
    passed,
    answers: results,
    duration_seconds: durationSeconds,
  });

  if (insertError) {
    reportError("exam", "attempt insert failed", insertError);
    return NextResponse.json({ error: t("examSaveFailed") }, { status: 500 });
  }

  const response = {
    score,
    total,
    passed,
    pass_mark: EXAM_PASS_MARK,
    results,
  };

  if (!passed) return NextResponse.json(response);

  try {
    const { data: medalSlug, error: medalError } = await supabase.rpc("award_exam_pass_medal");
    if (medalError) throw medalError;
    return NextResponse.json(medalSlug ? { ...response, medals_earned: [medalSlug] } : response);
  } catch (achievementError) {
    reportError("exam", "achievement persistence failed", achievementError);
    return NextResponse.json(response);
  }
}
