import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחוברת" }, { status: 401 });

  const { data } = await supabase
    .from("user_schedule")
    .select("*")
    .eq("user_id", user.id)
    .order("day_of_week");

  return NextResponse.json(data ?? []);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "לא מחוברת" }, { status: 401 });

  const { days, start_time, duration_minutes, notify } = await request.json();

  if (!Array.isArray(days) || !start_time) {
    return NextResponse.json({ error: "פרמטרים שגויים" }, { status: 400 });
  }

  // Replace schedule: delete existing, insert new
  await supabase.from("user_schedule").delete().eq("user_id", user.id);

  if (days.length > 0) {
    const rows = days.map((day: number) => ({
      user_id: user.id,
      day_of_week: day,
      start_time,
      duration_minutes: duration_minutes ?? 45,
      notify: notify ?? true,
    }));
    await supabase.from("user_schedule").insert(rows);
  }

  return NextResponse.json({ ok: true });
}
