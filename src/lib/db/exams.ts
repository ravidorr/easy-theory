import type { SupabaseClient } from "@supabase/supabase-js";
import { sampleIds } from "../exam";
import { throwOnDbError, type Question } from "./shared";

export type ExamAttempt = {
  id: string;
  score: number;
  total: number;
  passed: boolean;
  duration_seconds: number | null;
  created_at: string;
};

export type ExamSession = {
  id: string;
  question_ids: string[];
  answers: Record<string, "a" | "b" | "c" | "d">;
  marked_question_ids: string[];
  current_index: number;
  revision: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  attempt_id: string | null;
  result: Record<string, unknown> | null;
};

export async function getActiveExamSession(
  supabase: SupabaseClient,
  userId: string
): Promise<ExamSession | null> {
  const { data, error } = await supabase
    .from("user_exam_sessions")
    .select("id, question_ids, answers, marked_question_ids, current_index, revision, started_at, expires_at, submitted_at, attempt_id, result")
    .eq("user_id", userId)
    .is("submitted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwOnDbError(error, "getActiveExamSession: user_exam_sessions");
  return data ?? null;
}

export async function getOrCreateExamSession(
  supabase: SupabaseClient,
  userId: string
): Promise<ExamSession> {
  const existing = await getActiveExamSession(supabase, userId);
  if (existing) return existing;

  const { data, error } = await supabase.rpc("create_exam_session");
  throwOnDbError(error, "getOrCreateExamSession: create_exam_session");
  if (!data) throw new Error("getOrCreateExamSession: create_exam_session returned no row");
  return data as ExamSession;
}

export async function getQuestionsByIds(supabase: SupabaseClient, ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .in("id", ids)
    .eq("is_active", true);
  throwOnDbError(error, "getQuestionsByIds: questions");
  const byId = new Map((data ?? []).map((question) => [question.id, question]));
  return ids.map((id) => byId.get(id)).filter((question): question is Question => question != null);
}

export async function getRandomExamQuestions(
  supabase: SupabaseClient,
  count: number
): Promise<Question[]> {
  const { data: idRows, error: idsError } = await supabase
    .from("questions")
    .select("id")
    .eq("is_active", true);
  throwOnDbError(idsError, "getRandomExamQuestions: question ids");
  if (!idRows?.length) return [];

  const pickedIds = sampleIds(
    idRows.map((row) => row.id),
    count
  );

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .in("id", pickedIds)
    .eq("is_active", true);
  throwOnDbError(questionsError, "getRandomExamQuestions: questions");
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
  const { data, error } = await supabase
    .from("user_exam_attempts")
    .select("id, score, total, passed, duration_seconds, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwOnDbError(error, "getExamAttempts: user_exam_attempts");
  return data ?? [];
}

export async function hasPassedExam(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("passed", true)
    .limit(1);
  throwOnDbError(error, "hasPassedExam: user_exam_attempts");
  return (data ?? []).length > 0;
}
