import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!topic) {
    return NextResponse.json({ error: "נושא לא נמצא" }, { status: 404 });
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_number, question_he, option_a, option_b, option_c, option_d, image_url")
    .eq("topic_id", topic.id)
    .order("question_number")
    .limit(20);

  return NextResponse.json(questions ?? []);
}
