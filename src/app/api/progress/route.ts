import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getApiTranslator, parseJsonBody } from "@/lib/api";
import { reportError } from "@/lib/monitoring";

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const allowed = await checkRateLimit(supabase, `progress:${user.id}`, 20, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: t("topicIdMissing") }, { status: 400 });

  const { topic_id, score, status } = body;
  if (!topic_id) return NextResponse.json({ error: t("topicIdMissing") }, { status: 400 });

  // Topic completion is established exclusively by submit_quiz_answer after
  // every question has been answered correctly. This endpoint only records
  // non-authoritative study activity.
  const safeStatus = status === "not_started" ? "not_started" : "in_progress";
  const safeScore = typeof score === "number" ? score : null;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("user_topic_progress")
    .select("id, best_score, status")
    .eq("user_id", user.id)
    .eq("topic_id", topic_id)
    .single();

  if (existing) {
    // Never downgrade from completed to a lesser status
    const effectiveStatus = existing.status === "completed" ? "completed" : safeStatus;
    const { error } = await admin
      .from("user_topic_progress")
      .update({
        status: effectiveStatus,
        last_studied_at: new Date().toISOString(),
        best_score:
          safeScore != null && (existing.best_score == null || safeScore > existing.best_score)
            ? safeScore
            : existing.best_score,
      })
      .eq("id", existing.id);
    if (error) {
      reportError("progress", "update failed", error);
      return NextResponse.json({ error: t("progressSaveFailed") }, { status: 500 });
    }
  } else {
    const { error } = await admin.from("user_topic_progress").insert({
      user_id: user.id,
      topic_id,
      status: safeStatus,
      last_studied_at: new Date().toISOString(),
      best_score: safeScore,
    });
    if (error) {
      reportError("progress", "insert failed", error);
      return NextResponse.json({ error: t("progressSaveFailed") }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
