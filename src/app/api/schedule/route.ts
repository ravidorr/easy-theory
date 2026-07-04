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

  // Validate inputs
  const validDays = days.every((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
  if (!validDays) {
    return NextResponse.json({ error: "ימים לא תקינים" }, { status: 400 });
  }
  if (typeof start_time !== "string" || !/^\d{2}:\d{2}$/.test(start_time)) {
    return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
  }

  // Replace schedule: delete existing, insert new rows atomically
  const { error: deleteError } = await supabase
    .from("user_schedule")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: "שגיאה בעדכון לוח הזמנים" }, { status: 500 });
  }

  if (days.length > 0) {
    const rows = days.map((day: number) => ({
      user_id: user.id,
      day_of_week: day,
      start_time,
      duration_minutes: duration_minutes ?? 45,
      notify: notify ?? true,
    }));
    const { error: insertError } = await supabase.from("user_schedule").insert(rows);
    if (insertError) {
      return NextResponse.json({ error: "שגיאה בשמירת לוח הזמנים" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
