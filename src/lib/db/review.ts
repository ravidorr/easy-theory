import type { SupabaseClient } from "@supabase/supabase-js";
import { isDue, type SrsReview } from "../srs";
import {
  fetchQuestionsByIds,
  throwOnDbError,
  type Question,
} from "./shared";

export type QuizMistake = Question & {
  selected_option: "a" | "b" | "c" | "d";
  // Next SRS review; null = never scheduled, treated as due (see migration 014).
  due_at: string | null;
};

export type MistakeScope = "all" | "lastSession";

export type SrsCard = {
  sign_id: string | null;
  question_id: string | null;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  last_reviewed_at: string;
};

export type SrsItem = { sign_id: string } | { question_id: string };

const SRS_COLUMNS =
  "sign_id, question_id, ease, interval_days, repetitions, due_at, last_reviewed_at";

export async function getSignSrsCards(
  supabase: SupabaseClient,
  userId: string
): Promise<SrsCard[]> {
  // Bounded by the sign catalog (277 rows), no paging needed.
  const { data, error } = await supabase
    .from("user_srs_cards")
    .select(SRS_COLUMNS)
    .eq("user_id", userId)
    .not("sign_id", "is", null);
  if (error) {
    throw new Error(`getSignSrsCards: query failed: ${error.message}`, { cause: error });
  }
  return data ?? [];
}

export async function getQuestionSrsCards(
  supabase: SupabaseClient,
  userId: string,
  questionIds: string[]
): Promise<SrsCard[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < questionIds.length; i += 100) {
    chunks.push(questionIds.slice(i, i + 100));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("user_srs_cards")
        .select(SRS_COLUMNS)
        .eq("user_id", userId)
        .in("question_id", chunk);
      if (error) {
        throw new Error(`getQuestionSrsCards: query failed: ${error.message}`, {
          cause: error,
        });
      }
      return data ?? [];
    })
  );

  return results.flat();
}

export async function upsertSrsCard(
  supabase: SupabaseClient,
  userId: string,
  item: SrsItem,
  review: SrsReview
): Promise<void> {
  const onConflict = "sign_id" in item ? "user_id,sign_id" : "user_id,question_id";
  const { error } = await supabase
    .from("user_srs_cards")
    .upsert({ user_id: userId, ...item, ...review }, { onConflict });
  if (error) {
    throw new Error(`upsertSrsCard: upsert failed: ${error.message}`, { cause: error });
  }
}

export async function getMistakesForTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  scope: MistakeScope = "all"
): Promise<QuizMistake[]> {
  // Filter by topic server-side via the questions join — passing all topic
  // question ids to .in() breaks on large topics (see fetchQuestionsByIds).
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
    .eq("questions.is_active", true)
    .order("answered_at", { ascending: false });

  throwOnDbError(error, "getMistakesForTopic: responses");
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

  const [questions, srsCards] = await Promise.all([
    fetchQuestionsByIds(supabase, mistakeIds),
    getQuestionSrsCards(supabase, userId, mistakeIds),
  ]);
  const dueByQuestion = new Map(
    srsCards.filter((c) => c.question_id != null).map((c) => [c.question_id!, c.due_at])
  );

  const mistakes: QuizMistake[] = questions.map((q) => ({
    ...q,
    selected_option: latestByQuestion.get(q.id)!.selected_option as "a" | "b" | "c" | "d",
    due_at: dueByQuestion.get(q.id) ?? null,
  }));

  // Due first (unscheduled counts as due), each group ordered by due_at
  // ascending with unscheduled mistakes ahead of scheduled ones.
  const dueTime = (m: QuizMistake) => (m.due_at == null ? -Infinity : Date.parse(m.due_at));
  return mistakes.sort((a, b) => {
    const dueRank = Number(!isDue(a.due_at)) - Number(!isDue(b.due_at));
    return dueRank !== 0 ? dueRank : dueTime(a) - dueTime(b);
  });
}

export async function getAnsweredQuestionIdsForTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_quiz_responses")
    .select("question_id, questions!inner(topic_id)")
    .eq("user_id", userId)
    .eq("questions.topic_id", topicId)
    .eq("questions.is_active", true);
  throwOnDbError(error, "getAnsweredQuestionIdsForTopic: user_quiz_responses");
  return new Set((data ?? []).map((row) => row.question_id));
}

export type BookmarkedQuestion = Question & {
  bookmarked_at: string;
};

export async function getBookmarkedQuestionIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  // Soft fallback: a failure renders toggles as "not bookmarked" instead of
  // breaking the quiz — the bookmark PUT is idempotent, so state self-heals.
  const { data } = await supabase
    .from("user_question_bookmarks")
    .select("question_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((row) => row.question_id));
}

export async function getBookmarkedQuestions(
  supabase: SupabaseClient,
  userId: string
): Promise<BookmarkedQuestion[]> {
  // One row per (user, question) via the table's primary key. Supabase caps a
  // single response at 1000 rows, so a user who bookmarks 1000+ of the 1,273
  // questions gets a truncated list — accepted deliberately; page through like
  // getTopicAccuracy if that ever becomes a real usage pattern.
  const { data: bookmarks, error } = await supabase
    .from("user_question_bookmarks")
    .select("question_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  throwOnDbError(error, "getBookmarkedQuestions: bookmarks");
  if (!bookmarks?.length) return [];

  const questions = await fetchQuestionsByIds(
    supabase,
    bookmarks.map((b) => b.question_id)
  );

  // fetchQuestionsByIds doesn't preserve order — restore newest-first.
  const byId = new Map(questions.map((q) => [q.id, q]));
  return bookmarks
    .map((b) => {
      const question = byId.get(b.question_id);
      return question ? { ...question, bookmarked_at: b.created_at } : null;
    })
    .filter((q) => q != null);
}
