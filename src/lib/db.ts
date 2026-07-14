import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/routing";
import { sampleIds } from "./exam";

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
  topicId: string
): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("topic_id", topicId)
    .order("question_number");
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
  locale: Locale;
};

export async function getUsersScheduledForDay(
  supabase: SupabaseClient,
  dayOfWeek: number
): Promise<ScheduleWithUser[]> {
  const { data } = await supabase
    .from("user_schedule")
    .select("user_id, start_time, duration_minutes, locale")
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
  const { data } = await supabase
    .from("user_push_subscriptions")
    .select("user_id, endpoint, auth, p256dh")
    .in("user_id", userIds);
  return data ?? [];
}

export type MistakeScope = "all" | "lastSession";

// ~100 UUIDs ≈ 4KB of URL — safely under request-line limits. A single .in()
// with a full topic's worth of ids (501 on the largest topic) produces an
// ~18KB GET URL that the server rejects.
const IN_FILTER_CHUNK_SIZE = 100;

async function fetchQuestionsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Question[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_FILTER_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + IN_FILTER_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .in("id", chunk);
      if (error) {
        throw new Error(`fetchQuestionsByIds: questions query failed: ${error.message}`, {
          cause: error,
        });
      }
      return data ?? [];
    })
  );

  return results.flat();
}

export async function getMistakesForTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  scope: MistakeScope = "all"
): Promise<QuizMistake[]> {
  // Filter by topic server-side via the questions join — passing all topic
  // question ids to .in() breaks on large topics (see IN_FILTER_CHUNK_SIZE).
  // One row per (user, question) thanks to the upsert in the quiz route, and
  // the join narrows to a single topic (largest: 501 questions), so this stays
  // under Supabase's 1000-row response cap without paging — unlike
  // getTopicAccuracy. Revisit if any topic approaches 1000 questions.
  const { data: responses, error } = await supabase
    .from("user_quiz_responses")
    .select(
      "question_id, selected_option, is_correct, answered_at, session_id, questions!inner(topic_id)"
    )
    .eq("user_id", userId)
    .eq("questions.topic_id", topicId)
    .order("answered_at", { ascending: false });

  if (error) {
    throw new Error(`getMistakesForTopic: responses query failed: ${error.message}`, {
      cause: error,
    });
  }
  if (!responses?.length) return [];

  const latestByQuestion = new Map<
    string,
    { selected_option: string; is_correct: boolean; session_id: string | null }
  >();
  for (const r of responses) {
    if (!latestByQuestion.has(r.question_id)) {
      latestByQuestion.set(r.question_id, r);
    }
  }

  if (scope === "lastSession") {
    // Responses are ordered newest-first, so the first row belongs to the latest session.
    // Legacy rows (null session_id, pre-migration 006) can't be grouped into sessions —
    // when the newest row is legacy, fall back to all-time rather than hiding real mistakes.
    const lastSessionId = responses[0].session_id;
    if (lastSessionId != null) {
      for (const [qId, r] of latestByQuestion) {
        if (r.session_id !== lastSessionId) latestByQuestion.delete(qId);
      }
    }
  }

  const mistakeIds = [...latestByQuestion.entries()]
    .filter(([, r]) => !r.is_correct)
    .map(([qId]) => qId);

  if (!mistakeIds.length) return [];

  const questions = await fetchQuestionsByIds(supabase, mistakeIds);

  return questions.map((q) => ({
    ...q,
    selected_option: latestByQuestion.get(q.id)!.selected_option as "a" | "b" | "c" | "d",
  }));
}

export type ExamAttempt = {
  id: string;
  score: number;
  total: number;
  passed: boolean;
  duration_seconds: number | null;
  created_at: string;
};

export async function getRandomExamQuestions(
  supabase: SupabaseClient,
  count: number
): Promise<Question[]> {
  const { data: idRows } = await supabase.from("questions").select("id");
  if (!idRows?.length) return [];

  const pickedIds = sampleIds(
    idRows.map((row) => row.id),
    count
  );

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .in("id", pickedIds);
  if (!questions?.length) return [];

  // .in() doesn't preserve order — restore the shuffled order.
  const byId = new Map(questions.map((q) => [q.id, q]));
  return pickedIds.map((id) => byId.get(id)).filter((q) => q != null);
}

export async function getExamAttempts(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<ExamAttempt[]> {
  const { data } = await supabase
    .from("user_exam_attempts")
    .select("id, score, total, passed, duration_seconds, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
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
    const { data } = await supabase
      .from("user_quiz_responses")
      .select("is_correct, questions(topic_id)")
      .eq("user_id", userId)
      .order("question_id")
      .range(from, from + TOPIC_ACCURACY_PAGE_SIZE - 1);

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

export async function getTopicQuestionCounts(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const { data } = await supabase.from("topics").select("id, questions(count)");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    // supabase-js may type the aggregate relation as object or array.
    const related = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    counts[row.id] = related?.count ?? 0;
  }
  return counts;
}

export async function markTopicCompleted(
  supabase: SupabaseClient,
  userId: string,
  topicId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("user_topic_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .single();

  if (existing) {
    if (existing.status !== "completed") {
      await supabase
        .from("user_topic_progress")
        .update({ status: "completed", last_studied_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
  } else {
    await supabase.from("user_topic_progress").insert({
      user_id: userId,
      topic_id: topicId,
      status: "completed",
      last_studied_at: new Date().toISOString(),
    });
  }
}
