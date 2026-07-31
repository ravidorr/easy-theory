import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase";
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

  const { answers, duration_seconds, session_id } = body;
  if (!Array.isArray(answers) && (typeof session_id !== "string" || !UUID_RE.test(session_id))) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  if (typeof session_id === "string" && UUID_RE.test(session_id)) {
    const admin = createAdminClient();
    const { data, error } = await supabase.rpc("finalize_exam_session", { p_session_id: session_id });
    if (error) {
      const status = error.message === "exam_session_not_found" ? 404
        : error.message === "exam_session_invalidated" ? 409
        : 500;
      reportError("exam", "session finalization failed", error, { userId: user.id, sessionId: session_id });
      return NextResponse.json({ error: t("examSaveFailed") }, { status });
    }
    const response = data as Record<string, unknown>;
    if (response.passed !== true) return NextResponse.json(response);
    try {
      const { data: medalSlug, error: medalError } = await admin.rpc("award_exam_pass_medal", {
        p_user_id: user.id,
      });
      if (medalError) throw medalError;
      return NextResponse.json(medalSlug ? { ...response, medals_earned: [medalSlug] } : response);
    } catch (achievementError) {
      reportError("exam", "achievement persistence failed", achievementError);
      return NextResponse.json(response);
    }
  }

  const validAnswers: ExamAnswer[] = Array.isArray(answers) ? answers.filter(
    (a): a is ExamAnswer =>
      a != null &&
      typeof a.question_id === "string" &&
      UUID_RE.test(a.question_id) &&
      typeof a.selected_option === "string" &&
      OPTION_RE.test(a.selected_option)
  ) : [];

  const admin = createAdminClient();

  if (validAnswers.length > EXAM_QUESTION_COUNT) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  let correctById = new Map<string, string>();
  let topicByQuestionId = new Map<string, string>();
  const allowedQuestionIds = validAnswers.map((answer) => answer.question_id);
  if (allowedQuestionIds.length > 0) {
    const { data: questions } = await supabase
      .from("questions")
      .select("id, correct_option, topic_id")
      .in("id", allowedQuestionIds)
      .eq("is_active", true);
    correctById = new Map((questions ?? []).map((q) => [q.id, q.correct_option]));
    topicByQuestionId = new Map((questions ?? []).map((q) => [q.id, q.topic_id]));
  }

  const { score, results } = scoreExam(validAnswers, correctById);
  const total = EXAM_QUESTION_COUNT;
  const passed = score >= EXAM_PASS_MARK;

  const durationSeconds = typeof duration_seconds === "number" && Number.isFinite(duration_seconds)
    ? Math.max(0, Math.round(duration_seconds))
    : null;

  // Scores are computed above from server-fetched answers. Persist the result
  // with the service-role client so browser sessions cannot forge passing rows.
  const { error: insertError } = await admin.from("user_exam_attempts").insert({
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

  const topic_breakdown = results.reduce<Record<string, { correct: number; total: number }>>(
    (breakdown, result) => {
      const topicId = topicByQuestionId.get(result.question_id);
      if (!topicId) return breakdown;
      const entry = breakdown[topicId] ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (result.is_correct) entry.correct += 1;
      breakdown[topicId] = entry;
      return breakdown;
    },
    {}
  );
  const response = {
    score,
    total,
    passed,
    pass_mark: EXAM_PASS_MARK,
    results,
    duration_seconds: durationSeconds,
    unanswered_count: Math.max(0, total - validAnswers.length),
    topic_breakdown,
  };

  if (!passed) return NextResponse.json(response);

  try {
    const { data: medalSlug, error: medalError } = await admin.rpc("award_exam_pass_medal", {
      p_user_id: user.id,
    });
    if (medalError) throw medalError;
    return NextResponse.json(medalSlug ? { ...response, medals_earned: [medalSlug] } : response);
  } catch (achievementError) {
    reportError("exam", "achievement persistence failed", achievementError);
    return NextResponse.json(response);
  }
}
