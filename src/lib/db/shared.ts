import type { SupabaseClient } from "@supabase/supabase-js";

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
  explanation_ar?: string | null;
  explanation_he_source_url?: string | null;
  explanation_ar_source_url?: string | null;
  is_active?: boolean;
  source_release_id?: string | null;
};

export function throwOnDbError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context} query failed: ${error.message}`, { cause: error });
}

// ~100 UUIDs ≈ 4KB of URL — safely under request-line limits. A single .in()
// with a full topic's worth of ids (501 on the largest topic) produces an
// ~18KB GET URL that the server rejects.
const IN_FILTER_CHUNK_SIZE = 100;

export async function fetchQuestionsByIds(
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
        .in("id", chunk)
        .eq("is_active", true);
      throwOnDbError(error, "fetchQuestionsByIds: questions");
      return data ?? [];
    })
  );

  return results.flat();
}
