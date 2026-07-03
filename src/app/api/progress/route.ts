import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחוברת" }, { status: 401 });

  const { topic_id, score, status } = await request.json();
  if (!topic_id) return NextResponse.json({ error: "topic_id חסר" }, { status: 400 });

  const validStatus = ["not_started", "in_progress", "completed"];
  const safeStatus = validStatus.includes(status) ? status : "in_progress";

  const { data: existing } = await supabase
    .from("user_topic_progress")
    .select("id, best_score")
    .eq("user_id", user.id)
    .eq("topic_id", topic_id)
    .single();

  if (existing) {
    await supabase
      .from("user_topic_progress")
      .update({
        status: safeStatus,
        last_studied_at: new Date().toISOString(),
        best_score:
          score != null && (existing.best_score == null || score > existing.best_score)
            ? score
            : existing.best_score,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("user_topic_progress").insert({
      user_id: user.id,
      topic_id,
      status: safeStatus,
      last_studied_at: new Date().toISOString(),
      best_score: score ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
