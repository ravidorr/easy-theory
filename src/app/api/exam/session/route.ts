import { NextResponse } from "next/server";
import { getApiContext, parseJsonBody } from "@/lib/api";
import { reportError } from "@/lib/monitoring";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPTION_RE = /^[a-d]$/;

export async function PATCH(request: Request) {
  const { t, supabase } = await getApiContext(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const body = await parseJsonBody(request);
  if (!body || typeof body.session_id !== "string" || !UUID_RE.test(body.session_id)) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  const answers = body.answers;
  const validAnswers =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? Object.fromEntries(
          Object.entries(answers).filter(([questionId, option]) =>
            UUID_RE.test(questionId) && typeof option === "string" && OPTION_RE.test(option)
          )
        )
      : undefined;
  const currentIndex = body.current_index;
  const marked = body.marked_question_ids;
  const revision = body.revision;
  if (
    typeof revision !== "number" || !Number.isInteger(revision) || revision < 0 ||
    (currentIndex !== undefined && (typeof currentIndex !== "number" || !Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex > 29)) ||
    (marked !== undefined && (!Array.isArray(marked) || marked.some((id) => typeof id !== "string" || !UUID_RE.test(id))))
  ) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  if (validAnswers === undefined || currentIndex === undefined || marked === undefined) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("update_exam_session", {
    p_session_id: body.session_id,
    p_revision: revision,
    p_answers: validAnswers,
    p_current_index: currentIndex,
    p_marked_question_ids: marked,
  });
  if (error) {
    if (error.message === "exam_session_conflict" || error.message === "exam_session_expired") {
      return NextResponse.json({ error: t("examSaveFailed"), code: error.message }, { status: 409 });
    }
    reportError("exam-session", "update failed", error, { userId: user.id });
    return NextResponse.json({ error: t("examSaveFailed") }, { status: 500 });
  }
  return NextResponse.json({ ok: true, revision: data });
}
