import type { SupabaseClient } from "@supabase/supabase-js";

export type Topic = {
  id: string;
  slug: string;
  name_he: string;
  name_ar: string | null;
  description_he: string | null;
  description_ar: string | null;
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
  explanation_ar?: string | null;
  explanation_he_source_url?: string | null;
  explanation_ar_source_url?: string | null;
  is_active?: boolean;
  source_release_id?: string | null;
};

export type Sign = {
  id: string;
  sign_number: string;
  name_he: string;
  meaning_he: string | null;
  image_path: string;
  category: string;
  source_release_id?: string | null;
  source_url?: string | null;
  is_active?: boolean;
};

export type Video = {
  id: string;
  youtube_id: string;
  section: "marathon" | "lesson";
  is_featured: boolean;
  order_index: number;
  title_he: string;
  title_ar: string | null;
  description_he: string | null;
  description_ar: string | null;
  tag_he: string | null;
  tag_ar: string | null;
  duration_label_he: string | null;
  duration_label_ar: string | null;
};

export type Resource = {
  id: string;
  href: string;
  section: "official" | "practice";
  order_index: number;
  title_he: string;
  title_ar: string | null;
  description_he: string | null;
  description_ar: string | null;
  icon_type: "sign" | "char";
  icon_value: string;
  icon_variant: "neutral" | "primary" | "success" | "muted";
};

// Failed queries throw instead of pretending the result is empty. The one
// deliberate exception is getBookmarkedQuestionIds in the learner module.
export function throwOnDbError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context} query failed: ${error.message}`, { cause: error });
}

export async function getTopics(supabase: SupabaseClient): Promise<Topic[]> {
  const { data, error } = await supabase.from("topics").select("*").order("order_index");
  throwOnDbError(error, "getTopics: topics");
  return data ?? [];
}

export async function getTopicBySlug(supabase: SupabaseClient, slug: string): Promise<Topic | null> {
  const { data, error } = await supabase.from("topics").select("*").eq("slug", slug).maybeSingle();
  throwOnDbError(error, "getTopicBySlug: topics");
  return data ?? null;
}

export async function getQuestionsForTopic(supabase: SupabaseClient, topicId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions").select("*").eq("topic_id", topicId).eq("is_active", true).order("question_number");
  throwOnDbError(error, "getQuestionsForTopic: questions");
  return data ?? [];
}

export async function getVideos(supabase: SupabaseClient): Promise<Video[]> {
  const { data, error } = await supabase.from("videos").select("*").order("order_index");
  throwOnDbError(error, "getVideos: videos");
  return data ?? [];
}

export async function getResources(supabase: SupabaseClient): Promise<Resource[]> {
  const { data, error } = await supabase.from("resources").select("*").order("order_index");
  throwOnDbError(error, "getResources: resources");
  return data ?? [];
}

export async function getSigns(supabase: SupabaseClient, limit = 100): Promise<Sign[]> {
  const { data, error } = await supabase
    .from("signs").select("*").eq("is_active", true).order("sign_number").limit(limit);
  throwOnDbError(error, "getSigns: signs");
  return data ?? [];
}
