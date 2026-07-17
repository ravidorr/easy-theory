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

// Known submit_quiz_answer exceptions, mapped to a status plus a
// machine-readable code the client can branch on (uppercase convention
// shared with JS.Auth codes). Anything unmapped is an opaque failure.
const RPC_ERROR_RESPONSES: Record<
  string,
  { status: number; code: string; messageKey: "notAuthenticated" | "invalidParams" | "questionNotFound" | "tooManyRequests" }
> = {
  not_authenticated: { status: 401, code: "NOT_AUTHENTICATED", messageKey: "notAuthenticated" },
  invalid_quiz_submission: { status: 400, code: "INVALID_SUBMISSION", messageKey: "invalidParams" },
  question_not_found: { status: 404, code: "QUESTION_NOT_FOUND", messageKey: "questionNotFound" },
  topic_question_mismatch: { status: 400, code: "TOPIC_MISMATCH", messageKey: "invalidParams" },
  idempotency_key_conflict: { status: 409, code: "IDEMPOTENCY_CONFLICT", messageKey: "invalidParams" },
  rate_limited: { status: 429, code: "RATE_LIMITED", messageKey: "tooManyRequests" },
};

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: t("notAuthenticated"), code: "NOT_AUTHENTICATED" },
      { status: 401 }
    );
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json(
      { error: t("missingParams"), code: "INVALID_REQUEST" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: t("missingParams"), code: "INVALID_REQUEST" },
      { status: 400 }
    );
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
    const known = RPC_ERROR_RESPONSES[error.message];
    if (known) {
      return NextResponse.json(
        { error: t(known.messageKey), code: known.code },
        { status: known.status }
      );
    }
    // Opaque failure: return a short correlation ref and log the full
    // context under it, so a failed request seen in the browser's network
    // tab can be matched to this exact server log entry.
    const ref = crypto.randomUUID().slice(0, 8);
    console.error("[quiz] transactional submission failed:", {
      ref,
      userId: user.id,
      questionId: question_id,
      topicId,
      sessionId,
      idempotencyKey: idempotency_key,
      pg: {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    });
    if (error.message === "idempotency_result_missing") {
      // A committed claim with no stored result should be unreachable via
      // the RPC alone (claim and result commit atomically) — logged above
      // as an anomaly, but transient and retryable from the client's view.
      return NextResponse.json(
        { error: t("answerSaveInFlight"), code: "SUBMISSION_IN_FLIGHT", ref },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: t("answerSaveFailed"), code: "SUBMISSION_FAILED", ref },
      { status: 500 }
    );
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
