import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase";
import { getUsersScheduledForDay } from "@/lib/db";

const APP_URL = "https://easy-theory-omega.vercel.app";

function getIsraelDayOfWeek(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
  }).formatToParts(now);

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  return weekdayMap[weekday] ?? 0;
}

function formatTime(startTime: string): string {
  // start_time is stored as "HH:MM:00" — display as "HH:MM"
  return startTime.slice(0, 5);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const dayOfWeek = getIsraelDayOfWeek();
  const admin = createAdminClient();
  const schedules = await getUsersScheduledForDay(admin, dayOfWeek);

  if (schedules.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  await Promise.all(
    schedules.map(async (s) => {
      const { data: userData } = await admin.auth.admin.getUserById(s.user_id);
      const email = userData?.user?.email;
      if (!email) return;

      const time = formatTime(s.start_time);
      const duration = s.duration_minutes;
      await resend.emails.send({
        from: "Easy Theory <noreply@easy-theory-omega.vercel.app>",
        to: email,
        subject: "📅 לוח הלימודים שלך להיום",
        text: [
          "שלום!",
          "",
          "הנה לוח הלימודים שלך להיום:",
          "",
          `📖 שיעור בשעה ${time} — ${duration} דקות`,
          "",
          `לחץ כאן להתחיל: ${APP_URL}`,
          "",
          "בהצלחה!",
        ].join("\n"),
      });
      sent++;
    })
  );

  return NextResponse.json({ sent });
}
