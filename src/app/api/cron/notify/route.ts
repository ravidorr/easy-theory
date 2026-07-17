import { NextResponse } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase";
import { getUsersScheduledForDay, getPushSubscriptionsForUsers } from "@/lib/db";
import { getNotifyTranslator } from "@/lib/api";
import { reportError } from "@/lib/monitoring";
import { APP_TIME_ZONE } from "@/lib/personalization";

const APP_URL = "https://easy-theory-omega.vercel.app";

function getIsraelDayOfWeek(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
  }).formatToParts(now);

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  return weekdayMap[weekday] ?? 0;
}

function formatTime(startTime: string): string {
  return startTime.slice(0, 5);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayOfWeek = getIsraelDayOfWeek();
  const admin = createAdminClient();
  const schedules = await getUsersScheduledForDay(admin, dayOfWeek);

  if (schedules.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const userIds = schedules.map((s) => s.user_id);
  const pushSubs = await getPushSubscriptionsForUsers(admin, userIds);
  const pushSubsByUser = new Map(pushSubs.map((s) => [s.user_id, s]));

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;

  await Promise.all(
    schedules.map(async (s) => {
      const time = formatTime(s.start_time);
      const duration = s.duration_minutes;
      const pushSub = pushSubsByUser.get(s.user_id);
      const t = getNotifyTranslator(s.locale === "ar" ? "ar" : "he");

      if (pushSub) {
        try {
          await webpush.sendNotification(
            { endpoint: pushSub.endpoint, keys: { auth: pushSub.auth, p256dh: pushSub.p256dh } },
            JSON.stringify({
              title: t("pushTitle"),
              body: t("pushBody", { time, duration }),
              url: APP_URL,
            })
          );
          sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired — remove it
            await admin
              .from("user_push_subscriptions")
              .delete()
              .eq("user_id", s.user_id)
              .eq("endpoint", pushSub.endpoint);
          } else {
            // WebPushError carries the subscription endpoint (a capability
            // URL) plus the push service's response headers/body as own
            // properties, which the SDK would serialize into the event —
            // report a stripped copy so none of that leaves our
            // infrastructure.
            const sanitized = new Error(
              err instanceof Error ? err.message : String(err)
            );
            sanitized.name = err instanceof Error ? err.name : "PushSendError";
            reportError("notify", "push send failed", sanitized, {
              userId: s.user_id,
              statusCode,
            });
          }
        }
        return;
      }

      // Fallback: email
      const { data: userData } = await admin.auth.admin.getUserById(s.user_id);
      const email = userData?.user?.email;
      if (!email) return;

      await resend.emails.send({
        from: "Easy Theory <noreply@easy-theory-omega.vercel.app>",
        to: email,
        subject: t("emailSubject"),
        text: [
          t("emailGreeting"),
          "",
          t("emailScheduleHeader"),
          "",
          t("emailLesson", { time, duration }),
          "",
          t("emailCta", { url: APP_URL }),
          "",
          t("emailGoodLuck"),
        ].join("\n"),
      });
      sent++;
    })
  );

  return NextResponse.json({ sent });
}
