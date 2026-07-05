import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase";
import { getUsersDueNow } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = "https://easy-theory-omega.vercel.app";

function getIsraelDayAndTime(): { dayOfWeek: number; startTimePrefix: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  // Normalize hour 24 -> 00 (Intl sometimes returns "24")
  const normalizedHour = hour === "24" ? "00" : hour;

  return {
    dayOfWeek: weekdayMap[weekday] ?? 0,
    startTimePrefix: `${normalizedHour}:${minute}`,
  };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { dayOfWeek, startTimePrefix } = getIsraelDayAndTime();
  const admin = createAdminClient();
  const schedules = await getUsersDueNow(admin, dayOfWeek, startTimePrefix);

  if (schedules.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  await Promise.all(
    schedules.map(async (s) => {
      const { data: userData } = await admin.auth.admin.getUserById(s.user_id);
      const email = userData?.user?.email;
      if (!email) return;

      const duration = s.duration_minutes;
      await resend.emails.send({
        from: "Easy Theory <noreply@easy-theory-omega.vercel.app>",
        to: email,
        subject: "⏰ זמן ללמוד! השיעור שלך מתחיל עכשיו",
        text: [
          "שלום!",
          "",
          `הגיע הזמן לשיעור תיאוריה שלך 📖`,
          `משך: ${duration} דקות`,
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
