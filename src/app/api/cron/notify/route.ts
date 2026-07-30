import { NextResponse } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase";
import {
  claimScheduleNotification,
  completeScheduleNotification,
  getPushSubscriptionsForUsers,
  getUsersWithEnabledNotifications,
  releaseScheduleNotification,
} from "@/lib/db";
import { getNotifyTranslator } from "@/lib/api";
import { reportError } from "@/lib/monitoring";

const APP_URL = "https://easy-theory-omega.vercel.app";

const weekdayMap: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function getLocalScheduleDate(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = weekdayMap[values.weekday] ?? 0;
  return {
    dayOfWeek: weekday,
    localDate: `${values.year}-${values.month}-${values.day}`,
  };
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

  const admin = createAdminClient();
  const schedules = await getUsersWithEnabledNotifications(admin);
  const scheduledToday = schedules.flatMap((schedule) => {
    const { dayOfWeek, localDate } = getLocalScheduleDate(schedule.time_zone);
    return schedule.day_of_week === dayOfWeek ? [{ schedule, localDate }] : [];
  });

  if (scheduledToday.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const userIds = scheduledToday.map(({ schedule }) => schedule.user_id);
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
    scheduledToday.map(async ({ schedule: s, localDate }) => {
      const claimed = await claimScheduleNotification(admin, s.user_id, localDate);
      if (!claimed) return;

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
          await completeScheduleNotification(admin, s.user_id, localDate);
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
          await releaseScheduleNotification(admin, s.user_id, localDate);
        }
        return;
      }

      // Fallback: email
      const { data: userData } = await admin.auth.admin.getUserById(s.user_id);
      const email = userData?.user?.email;
      if (!email) {
        await completeScheduleNotification(admin, s.user_id, localDate);
        return;
      }

      try {
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
        await completeScheduleNotification(admin, s.user_id, localDate);
        sent++;
      } catch (err) {
        await releaseScheduleNotification(admin, s.user_id, localDate);
        throw err;
      }
    })
  );

  return NextResponse.json({ sent });
}
