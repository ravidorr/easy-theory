import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getApiTranslator, getRequestLocale, parseJsonBody } from "@/lib/api";
import { reportError } from "@/lib/monitoring";

export async function GET(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const { data } = await supabase
    .from("user_schedule")
    .select("*")
    .eq("user_id", user.id)
    .order("day_of_week");

  return NextResponse.json(data ?? []);
}

export async function PUT(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });

  const allowed = await checkRateLimit(supabase, `schedule:${user.id}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
  }
  const { days, start_time, duration_minutes, notify } = body;

  if (!Array.isArray(days) || !start_time) {
    return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
  }

  // Validate inputs
  const validDays = days.every((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
  if (!validDays) {
    return NextResponse.json({ error: t("invalidDays") }, { status: 400 });
  }
  if (typeof start_time !== "string" || !/^\d{2}:\d{2}$/.test(start_time)) {
    return NextResponse.json({ error: t("invalidTime") }, { status: 400 });
  }

  // Replace the schedule atomically (delete + insert in one transaction, migration 008).
  // The locale is stored per row so cron notifications go out in the user's language
  // (migration 009).
  const { error } = await supabase.rpc("replace_user_schedule", {
    p_days: days,
    p_start_time: start_time,
    p_duration_minutes: duration_minutes ?? 45,
    p_notify: notify ?? true,
    p_locale: getRequestLocale(request),
  });

  if (error) {
    reportError("schedule", "replace failed", error);
    return NextResponse.json({ error: t("scheduleUpdateFailed") }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
