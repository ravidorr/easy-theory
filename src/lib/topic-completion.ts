import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkTopicCompletion(
  supabase: SupabaseClient,
  userId: string,
  topicId: string
): Promise<boolean> {
  const { data: questions, error: qError } = await supabase
    .from("questions")
    .select("id")
    .eq("topic_id", topicId);

  if (qError || !questions || questions.length === 0) return false;

  const allIds = questions.map((q) => q.id);

  const { data: responses, error: rError } = await supabase
    .from("user_quiz_responses")
    .select("question_id")
    .eq("user_id", userId)
    .eq("is_correct", true)
    .in("question_id", allIds);

  if (rError || !responses) return false;

  return new Set(responses.map((r) => r.question_id)).size === allIds.length;
}
