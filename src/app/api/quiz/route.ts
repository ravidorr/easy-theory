import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

const STREAK_MILESTONES = [3, 7, 14, 30];
const POINTS_PER_CORRECT = 10;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "לא מחוברת" }, { status: 401 });
  }

  const { question_id, selected_option, topic_id } = await request.json();

  if (!question_id || !selected_option) {
    return NextResponse.json({ error: "חסרים פרמטרים" }, { status: 400 });
  }

  // Fetch question to check correct answer
  const { data: question } = await supabase
    .from("questions")
    .select("correct_option, explanation_he")
    .eq("id", question_id)
    .single();

  if (!question) {
    return NextResponse.json({ error: "שאלה לא נמצאה" }, { status: 404 });
  }

  const is_correct = question.correct_option === selected_option;

  // Save response
  await supabase.from("user_quiz_responses").insert({
    user_id: user.id,
    question_id,
    selected_option,
    is_correct,
  });

  let stars_earned = 0;
  const medals_earned: string[] = [];

  if (is_correct) {
    stars_earned = POINTS_PER_CORRECT;

    // Upsert user_stats
    const today = new Date().toISOString().split("T")[0];

    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!stats) {
      await supabase.from("user_stats").insert({
        user_id: user.id,
        star_points: POINTS_PER_CORRECT,
        streak_days: 1,
        last_active_date: today,
      });
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const newStreak =
        stats.last_active_date === today
          ? stats.streak_days
          : stats.last_active_date === yesterdayStr
            ? stats.streak_days + 1
            : 1;

      await supabase
        .from("user_stats")
        .update({
          star_points: stats.star_points + POINTS_PER_CORRECT,
          streak_days: newStreak,
          last_active_date: today,
        })
        .eq("user_id", user.id);

      // Streak milestone medals
      if (
        newStreak !== stats.streak_days &&
        STREAK_MILESTONES.includes(newStreak)
      ) {
        const slug = `streak-${newStreak}`;
        const { error } = await supabase
          .from("user_medals")
          .insert({ user_id: user.id, medal_slug: slug });
        if (!error) medals_earned.push(slug);
      }
    }
  }

  // Update topic progress if topic_id provided
  if (topic_id && is_correct) {
    const { data: progress } = await supabase
      .from("user_topic_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("topic_id", topic_id)
      .single();

    if (!progress) {
      await supabase.from("user_topic_progress").insert({
        user_id: user.id,
        topic_id,
        status: "in_progress",
        last_studied_at: new Date().toISOString(),
      });
    } else if (progress.status !== "completed") {
      await supabase
        .from("user_topic_progress")
        .update({
          status: "in_progress",
          last_studied_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("topic_id", topic_id);
    }
  }

  // Fetch updated stats
  const { data: updatedStats } = await supabase
    .from("user_stats")
    .select("star_points, streak_days")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    is_correct,
    correct_option: question.correct_option,
    explanation_he: question.explanation_he,
    stars_earned,
    new_total_stars: updatedStats?.star_points ?? 0,
    streak_days: updatedStats?.streak_days ?? 0,
    medals_earned,
  });
}
