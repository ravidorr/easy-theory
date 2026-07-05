import type { SupabaseClient } from "@supabase/supabase-js";

export type Topic = {
  id: string;
  slug: string;
  name_he: string;
  description_he: string | null;
  order_index: number;
  icon: string | null;
};

export type Question = {
  id: string;
  topic_id: string;
  question_number: number;
  question_he: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  image_url: string | null;
  explanation_he: string | null;
};

export type Sign = {
  id: string;
  sign_number: string;
  name_he: string;
  meaning_he: string | null;
  image_path: string;
  category: string;
};

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
};

export async function getTopics(supabase: SupabaseClient): Promise<Topic[]> {
  const { data } = await supabase
    .from("topics")
    .select("*")
    .order("order_index");
  return data ?? [];
}

export async function getTopicBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Topic | null> {
  const { data } = await supabase
    .from("topics")
    .select("*")
    .eq("slug", slug)
    .single();
  return data ?? null;
}

export async function getQuestionsForTopic(
  supabase: SupabaseClient,
  topicId: string,
  limit = 8
): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("topic_id", topicId)
    .limit(limit);
  return data ?? [];
}

export async function getUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStats> {
  const { data } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();
  return (
    data ?? {
      user_id: userId,
      star_points: 0,
      streak_days: 0,
      last_active_date: null,
    }
  );
}

export async function getTopicProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<TopicProgress[]> {
  const { data } = await supabase
    .from("user_topic_progress")
    .select("topic_id, status, best_score, last_studied_at")
    .eq("user_id", userId);
  return data ?? [];
}

export async function getSigns(
  supabase: SupabaseClient,
  limit = 100
): Promise<Sign[]> {
  const { data } = await supabase
    .from("signs")
    .select("*")
    .order("sign_number")
    .limit(limit);
  return data ?? [];
}

export async function getUserSchedule(
  supabase: SupabaseClient,
  userId: string
): Promise<Schedule[]> {
  const { data } = await supabase
    .from("user_schedule")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_week");
  return data ?? [];
}

export type ScheduleWithUser = {
  user_id: string;
  start_time: string;
  duration_minutes: number;
};

export async function getUsersScheduledForDay(
  supabase: SupabaseClient,
  dayOfWeek: number
): Promise<ScheduleWithUser[]> {
  const { data } = await supabase
    .from("user_schedule")
    .select("user_id, start_time, duration_minutes")
    .eq("day_of_week", dayOfWeek)
    .eq("notify", true);
  return data ?? [];
}

export async function getUserMedals(
  supabase: SupabaseClient,
  userId: string
): Promise<{ medal_slug: string; earned_at: string }[]> {
  const { data } = await supabase
    .from("user_medals")
    .select("medal_slug, earned_at")
    .eq("user_id", userId)
    .order("earned_at");
  return data ?? [];
}

export type QuizMistake = Question & {
  selected_option: "a" | "b" | "c" | "d";
};

export async function getMistakesForTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string
): Promise<QuizMistake[]> {
  const { data: topicQuestions } = await supabase
    .from("questions")
    .select("id")
    .eq("topic_id", topicId);

  if (!topicQuestions?.length) return [];
  const questionIds = topicQuestions.map((q) => q.id);

  const { data: responses } = await supabase
    .from("user_quiz_responses")
    .select("question_id, selected_option, is_correct, answered_at")
    .eq("user_id", userId)
    .in("question_id", questionIds)
    .order("answered_at", { ascending: false });

  if (!responses?.length) return [];

  const latestByQuestion = new Map<string, { selected_option: string; is_correct: boolean }>();
  for (const r of responses) {
    if (!latestByQuestion.has(r.question_id)) {
      latestByQuestion.set(r.question_id, r);
    }
  }

  const mistakeIds = [...latestByQuestion.entries()]
    .filter(([, r]) => !r.is_correct)
    .map(([qId]) => qId);

  if (!mistakeIds.length) return [];

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .in("id", mistakeIds);

  return (questions ?? []).map((q) => ({
    ...q,
    selected_option: latestByQuestion.get(q.id)!.selected_option as "a" | "b" | "c" | "d",
  }));
}
