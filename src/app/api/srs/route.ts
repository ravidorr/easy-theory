import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getApiTranslator, parseJsonBody } from "@/lib/api";
import { upsertSrsCard } from "@/lib/db";
import { INITIAL_SRS_STATE, reviewCard } from "@/lib/srs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOREIGN_KEY_VIOLATION = "23503";

// Grades a flashcard (signs only). Question SRS state moves exclusively
// through real quiz answers in /api/quiz — an open grading endpoint for
// questions would let clients schedule away their mistakes.
export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  // Flashcard clicks come faster than quiz answers, hence 60/min.
  const allowed = await checkRateLimit(supabase, `srs:${user.id}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: t("missingParams") }, { status: 400 });

  const { sign_id, knew } = body;
  if (typeof sign_id !== "string" || !UUID_RE.test(sign_id) || typeof knew !== "boolean") {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  const { data: existing, error: selectError } = await supabase
    .from("user_srs_cards")
    .select("ease, interval_days, repetitions")
    .eq("user_id", user.id)
    .eq("sign_id", sign_id)
    .maybeSingle();
  if (selectError) {
    console.error("[srs] select failed:", selectError);
    return NextResponse.json({ error: t("srsSaveFailed") }, { status: 500 });
  }

  const review = reviewCard(existing ?? INITIAL_SRS_STATE, knew);
  try {
    await upsertSrsCard(supabase, user.id, { sign_id }, review);
  } catch (err) {
    const code = (err instanceof Error ? (err.cause as { code?: string })?.code : undefined);
    if (code === FOREIGN_KEY_VIOLATION) {
      return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
    }
    console.error("[srs] upsert failed:", err);
    return NextResponse.json({ error: t("srsSaveFailed") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, due_at: review.due_at });
}
