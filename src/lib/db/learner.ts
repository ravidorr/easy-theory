import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/routing";
import { throwOnDbError } from "./shared";

export type UserStats = {
  user_id: string;
  star_points: number;
  streak_days: number;
  last_active_date: string | null;
};

export type TopicProgress = {
  topic_id: string;
  status: "not_started" | "in_progress" | "completed";
  best_score: number | null;
  last_studied_at: string | null;
};

export type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  notify: boolean;
  time_zone: string;
};

export async function getUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStats> {
  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  throwOnDbError(error, "getUserStats: user_stats");
  return data ?? {
    user_id: userId,
    star_points: 0,
    streak_days: 0,
    last_active_date: null,
  };
}

export async function getTopicProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<TopicProgress[]> {
  const { data, error } = await supabase
    .from("user_topic_progress")
    .select("topic_id, status, best_score, last_studied_at")
    .eq("user_id", userId);
  throwOnDbError(error, "getTopicProgress: user_topic_progress");
  return data ?? [];
}

export async function getUserSchedule(
  supabase: SupabaseClient,
  userId: string
): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from("user_schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_week");
  throwOnDbError(error, "getUserSchedule: user_schedule");
  return data ?? [];
}

export type ScheduleWithUser = {
  user_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  locale: Locale;
  time_zone: string;
};

export async function getUsersWithEnabledNotifications(
  supabase: SupabaseClient
): Promise<ScheduleWithUser[]> {
  // A swallowed error here made the notify cron "succeed" with zero
  // notifications sent — throwing turns that into a visible HTTP 500 for the
  // cron caller.
  const { data, error } = await supabase
    .from("user_schedule")
    .select("user_id, day_of_week, start_time, duration_minutes, locale, time_zone")
    .eq("notify", true);
  throwOnDbError(error, "getUsersWithEnabledNotifications: user_schedule");
  return data ?? [];
}

/** Atomically reserve a user's daily reminder before dispatching it. */
export async function claimScheduleNotification(
  supabase: SupabaseClient,
  userId: string,
  localDate: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_schedule_notification", {
    p_user_id: userId,
    p_local_date: localDate,
  });
  throwOnDbError(error, "claimScheduleNotification: schedule_notification_deliveries");
  return data ?? false;
}

export async function completeScheduleNotification(
  supabase: SupabaseClient,
  userId: string,
  localDate: string
): Promise<void> {
  const { error } = await supabase
    .from("schedule_notification_deliveries")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("local_date", localDate);
  throwOnDbError(error, "completeScheduleNotification: schedule_notification_deliveries");
}

export async function releaseScheduleNotification(
  supabase: SupabaseClient,
  userId: string,
  localDate: string
): Promise<void> {
  const { error } = await supabase
    .from("schedule_notification_deliveries")
    .delete()
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .eq("status", "pending");
  throwOnDbError(error, "releaseScheduleNotification: schedule_notification_deliveries");
}

export async function getUserMedals(
  supabase: SupabaseClient,
  userId: string
): Promise<{ medal_slug: string; earned_at: string }[]> {
  const { data, error } = await supabase
    .from("user_medals")
    .select("medal_slug, earned_at")
    .eq("user_id", userId)
    .order("earned_at");
  throwOnDbError(error, "getUserMedals: user_medals");
  return data ?? [];
}

export type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  auth: string;
  p256dh: string;
};

export async function getPushSubscriptionsForUsers(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabase
    .from("user_push_subscriptions")
    .select("user_id, endpoint, auth, p256dh")
    .in("user_id", userIds);
  throwOnDbError(error, "getPushSubscriptionsForUsers: user_push_subscriptions");
  return data ?? [];
}

export type TopicAccuracy = {
  topic_id: string;
  correct: number;
  total: number;
};

const TOPIC_ACCURACY_PAGE_SIZE = 1000;

export async function getTopicAccuracy(
  supabase: SupabaseClient,
  userId: string
): Promise<TopicAccuracy[]> {
  // One row per (user, question) thanks to the upsert in the quiz route, so no
  // dedup is needed. The question bank (1,273 questions) exceeds Supabase's
  // 1000-row response cap, so page through all responses; question_id gives a
  // stable order for range pagination.
  const byTopic = new Map<string, { correct: number; total: number }>();

  for (let from = 0; ; from += TOPIC_ACCURACY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("user_quiz_responses")
      .select("is_correct, questions!inner(topic_id)")
      .eq("user_id", userId)
      .eq("questions.is_active", true)
      .order("question_id")
      .range(from, from + TOPIC_ACCURACY_PAGE_SIZE - 1);

    // A mid-pagination failure would otherwise silently truncate the results.
    throwOnDbError(error, "getTopicAccuracy: user_quiz_responses");
    const rows = data ?? [];
    for (const row of rows) {
      // supabase-js may type a to-one nested relation as object or array.
      const related = Array.isArray(row.questions) ? row.questions[0] : row.questions;
      const topicId = related?.topic_id;
      if (!topicId) continue;
      const acc = byTopic.get(topicId) ?? { correct: 0, total: 0 };
      acc.total += 1;
      if (row.is_correct) acc.correct += 1;
      byTopic.set(topicId, acc);
    }

    if (rows.length < TOPIC_ACCURACY_PAGE_SIZE) break;
  }

  return [...byTopic.entries()].map(([topic_id, acc]) => ({ topic_id, ...acc }));
}

/** Counts every accepted answer in the supplied half-open time window. */
export async function getQuizAnswerEventCountForWindow(
  supabase: SupabaseClient,
  userId: string,
  fromIso: string,
  toIso: string
): Promise<number> {
  const { count, error } = await supabase
    .from("quiz_answer_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("answered_at", fromIso)
    .lt("answered_at", toIso);
  throwOnDbError(error, "getQuizAnswerEventCountForWindow: quiz_answer_events");

  return count ?? 0;
}

export async function getTopicQuestionCounts(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const { data: activeData, error: activeError } = await supabase
    .from("topics")
    .select("id, questions!inner(count)")
    .eq("questions.is_active", true);

  const missingActivityColumn =
    activeError &&
    (/column questions(?:_\d+)?\.is_active does not exist/i.test(activeError.message) ||
      (activeError.code === "PGRST204" && /is_active/i.test(activeError.message)));
  const { data, error } = missingActivityColumn
    ? await supabase.from("topics").select("id, questions!inner(count)")
    : { data: activeData, error: activeError };
  throwOnDbError(error, "getTopicQuestionCounts: topics");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    // supabase-js may type the aggregate relation as object or array.
    const related = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    counts[row.id] = related?.count ?? 0;
  }
  return counts;
}
