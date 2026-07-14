import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getApiTranslator } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const t = getApiTranslator(request);
  const { slug } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!topic) {
    return NextResponse.json({ error: t("topicNotFound") }, { status: 404 });
  }

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, question_number, question_he, option_a, option_b, option_c, option_d, image_url")
    .eq("topic_id", topic.id)
    .order("question_number");

  if (error) {
    console.error("[topics] questions query failed:", error);
    return NextResponse.json({ error: t("questionsLoadFailed") }, { status: 500 });
  }

  return NextResponse.json(questions ?? []);
}
