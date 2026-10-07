import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/routing";
import { getLearnerPlan, getUserMedals, getUserSchedule, getUserStats } from "@/lib/db";

export type PendoVisitor = {
  id: string;
  email: string | null;
  starPoints: number;
  streakDays: number;
  lastActiveDate: string | null;
  targetExamDate: string | null;
  diagnosticCompletedAt: string | null;
  dailyQuestionGoal: number | null;
  locale: Locale | null;
  timeZone: string | null;
  notify: boolean | null;
  dayOfWeek: number[];
  startTime: string | null;
  durationMinutes: number | null;
  medalSlug: string[];
};

export async function getPendoVisitor(
  supabase: SupabaseClient,
  user: User
): Promise<PendoVisitor> {
  const [stats, plan, schedule, medals] = await Promise.all([
    getUserStats(supabase, user.id),
    getLearnerPlan(supabase, user.id),
    getUserSchedule(supabase, user.id),
    getUserMedals(supabase, user.id),
  ]);
  // replace_user_schedule writes the same time, duration, reminder setting,
  // locale, and time zone to every scheduled day.
  const slot = schedule[0];

  return {
    id: user.id,
    email: user.email ?? null,
    starPoints: stats.star_points,
    streakDays: stats.streak_days,
    lastActiveDate: stats.last_active_date,
    targetExamDate: plan?.target_exam_date ?? null,
    diagnosticCompletedAt: plan?.diagnostic_completed_at ?? null,
    dailyQuestionGoal: plan?.daily_question_goal ?? null,
    locale: slot?.locale ?? null,
    timeZone: slot?.time_zone ?? null,
    notify: slot?.notify ?? null,
    dayOfWeek: schedule.map((day) => day.day_of_week),
    startTime: slot?.start_time ?? null,
    durationMinutes: slot?.duration_minutes ?? null,
    medalSlug: medals.map((medal) => medal.medal_slug),
  };
}
