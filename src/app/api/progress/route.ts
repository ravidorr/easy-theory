import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחוברת" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, `progress:${user.id}`, 20, 60);
  if (!allowed) {
    return NextResponse.json({ error: "יותר מדי בקשות, נסי שוב עוד רגע" }, { status: 429 });
  }

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "topic_id חסר" }, { status: 400 });

  const { topic_id, score, status } = body;
  if (!topic_id) return NextResponse.json({ error: "topic_id חסר" }, { status: 400 });

  const validStatus = ["not_started", "in_progress", "completed"];
  const safeStatus = typeof status === "string" && validStatus.includes(status) ? status : "in_progress";
  const safeScore = typeof score === "number" ? score : null;

  const { data: existing } = await supabase
    .from("user_topic_progress")
    .select("id, best_score, status")
    .eq("user_id", user.id)
    .eq("topic_id", topic_id)
    .single();

  if (existing) {
    // Never downgrade from completed to a lesser status
    const effectiveStatus = existing.status === "completed" ? "completed" : safeStatus;
    const { error } = await supabase
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
      console.error("[progress] update failed:", error);
      return NextResponse.json({ error: "שמירת ההתקדמות נכשלה" }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("user_topic_progress").insert({
      user_id: user.id,
      topic_id,
      status: safeStatus,
      last_studied_at: new Date().toISOString(),
      best_score: safeScore,
    });
    if (error) {
      console.error("[progress] insert failed:", error);
      return NextResponse.json({ error: "שמירת ההתקדמות נכשלה" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
