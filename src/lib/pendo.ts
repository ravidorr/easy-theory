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

// user_stats counters are nullable in the database; segments need a number.
function count(value: number | null | undefined): number {
  return value ?? 0;
}

// user_schedule has no constraint tying a learner's rows together, so a field
// is only sent when every row agrees on it. Otherwise it is null rather than
// whichever row happened to sort first.
function uniform<Row, Key extends keyof Row>(rows: Row[], key: Key): Row[Key] | null {
  if (rows.length === 0) return null;
  const first = rows[0][key];
  return rows.every((row) => row[key] === first) ? first : null;
}

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
  return {
    id: user.id,
    email: user.email ?? null,
    starPoints: count(stats.star_points),
    streakDays: count(stats.streak_days),
    lastActiveDate: stats.last_active_date,
    targetExamDate: plan?.target_exam_date ?? null,
    diagnosticCompletedAt: plan?.diagnostic_completed_at ?? null,
    dailyQuestionGoal: plan?.daily_question_goal ?? null,
    locale: uniform(schedule, "locale"),
    timeZone: uniform(schedule, "time_zone"),
    notify: uniform(schedule, "notify"),
    dayOfWeek: schedule.map((day) => day.day_of_week),
    startTime: uniform(schedule, "start_time"),
    durationMinutes: uniform(schedule, "duration_minutes"),
    medalSlug: medals.map((medal) => medal.medal_slug),
  };
}
