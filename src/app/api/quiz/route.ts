import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getApiTranslator, parseJsonBody } from "@/lib/api";

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

  return NextResponse.json(data);
}
