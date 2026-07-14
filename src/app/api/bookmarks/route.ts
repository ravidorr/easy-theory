import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getApiTranslator, parseJsonBody } from "@/lib/api";

// Idempotent "set state" rather than a toggle, so retries and double-taps
// can't flip a bookmark to the wrong state.
export async function PUT(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const allowed = await checkRateLimit(supabase, `bookmarks:${user.id}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }
  const { question_id, bookmarked } = body;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    typeof question_id !== "string" ||
    !UUID_RE.test(question_id) ||
    typeof bookmarked !== "boolean"
  ) {
    return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
  }

  if (bookmarked) {
    const { error } = await supabase.from("user_question_bookmarks").upsert(
      { user_id: user.id, question_id },
      { onConflict: "user_id,question_id", ignoreDuplicates: true }
    );
    if (error) {
      // 23503 = foreign key violation: the question id doesn't exist.
      if (error.code === "23503") {
        return NextResponse.json({ error: t("questionNotFound") }, { status: 404 });
      }
      console.error("[bookmarks] upsert failed:", error);
      return NextResponse.json({ error: t("bookmarkUpdateFailed") }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("user_question_bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("question_id", question_id);
    if (error) {
      console.error("[bookmarks] delete failed:", error);
      return NextResponse.json({ error: t("bookmarkUpdateFailed") }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, bookmarked });
}
