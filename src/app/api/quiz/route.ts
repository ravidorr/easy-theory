import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getApiTranslator, parseJsonBody } from "@/lib/api";
import { upsertSrsCard } from "@/lib/db";
import { INITIAL_SRS_STATE, reviewCard } from "@/lib/srs";
import type { SupabaseClient } from "@supabase/supabase-js";

// Advance the question's SM-2 card after a graded answer. Deliberately
// non-atomic with submit_quiz_answer: a lost update self-heals on the next
// answer, and scheduling must never fail the quiz response. An idempotent
// replay of the same answer re-grades the card once — bounded and harmless.
async function updateQuestionSrs(
  supabase: SupabaseClient,
  userId: string,
  questionId: string,
  isCorrect: boolean
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("user_srs_cards")
    .select("ease, interval_days, repetitions")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (error) {
    throw new Error(`updateQuestionSrs: select failed: ${error.message}`, { cause: error });
  }
  const review = reviewCard(existing ?? INITIAL_SRS_STATE, isCorrect);
  await upsertSrsCard(supabase, userId, { question_id: questionId }, review);
}

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }
  const {
    question_id,
    selected_option,
    topic_id,
    session_id,
    idempotency_key,
  } = body;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    typeof question_id !== "string" ||
    !UUID_RE.test(question_id) ||
    (topic_id != null &&
      (typeof topic_id !== "string" || !UUID_RE.test(topic_id))) ||
    typeof selected_option !== "string" ||
    !["a", "b", "c", "d"].includes(selected_option) ||
    typeof idempotency_key !== "string" ||
    idempotency_key.length < 1 ||
    idempotency_key.length > 200
  ) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  const sessionId = typeof session_id === "string" && UUID_RE.test(session_id) ? session_id : null;
  const topicId = typeof topic_id === "string" ? topic_id : null;

  const { data, error } = await supabase.rpc("submit_quiz_answer", {
    p_idempotency_key: idempotency_key,
    p_question_id: question_id,
    p_selected_option: selected_option,
    p_topic_id: topicId,
    p_session_id: sessionId,
  });

  if (error) {
    if (error.message === "question_not_found") {
      return NextResponse.json({ error: t("questionNotFound") }, { status: 404 });
    }
    if (error.message === "idempotency_key_conflict") {
      return NextResponse.json({ error: t("invalidParams") }, { status: 409 });
    }
    if (error.message === "topic_question_mismatch") {
      return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
    }
    if (error.message === "rate_limited") {
      return NextResponse.json(
        { error: t("tooManyRequests") },
        { status: 429 }
      );
    }
    console.error("[quiz] transactional submission failed:", error);
    return NextResponse.json({ error: t("answerSaveFailed") }, { status: 500 });
  }

  if (typeof data?.is_correct === "boolean") {
    try {
      await updateQuestionSrs(supabase, user.id, question_id, data.is_correct);
    } catch (srsError) {
      console.error("[quiz] SRS update failed:", srsError);
    }
  }

  return NextResponse.json(data);
}
