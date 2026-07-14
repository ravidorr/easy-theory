import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import {
  STREAK_MILESTONES,
  POINTS_PER_CORRECT,
  computeNewStreak,
  isMilestoneReached,
} from "@/lib/quiz";
import { checkTopicCompletion } from "@/lib/topic-completion";
import { checkRateLimit } from "@/lib/rate-limit";
import { markTopicCompleted } from "@/lib/db";
import { getApiTranslator, parseJsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const t = getApiTranslator(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("notAuthenticated") }, { status: 401 });
  }

  const allowed = await checkRateLimit(supabase, `quiz:${user.id}`, 20, 60);
  if (!allowed) {
    return NextResponse.json({ error: t("tooManyRequests") }, { status: 429 });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }
  const { question_id, selected_option, topic_id, session_id } = body;

  if (!question_id || !selected_option) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }

  // The column is a Postgres UUID — coerce anything invalid to null so the upsert can't fail on it
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sessionId = typeof session_id === "string" && UUID_RE.test(session_id) ? session_id : null;
  const topicId = typeof topic_id === "string" ? topic_id : null;

  // Fetch question to check correct answer
  const { data: question } = await supabase
    .from("questions")
    .select("correct_option, explanation_he")
    .eq("id", question_id)
    .single();

  if (!question) {
    return NextResponse.json({ error: t("questionNotFound") }, { status: 404 });
  }

  const is_correct = question.correct_option === selected_option;

  // Check if user already answered this question correctly (prevent duplicate star awards)
  const { data: existingCorrect } = await supabase
    .from("user_quiz_responses")
    .select("id")
    .eq("user_id", user.id)
    .eq("question_id", question_id)
    .eq("is_correct", true)
    .maybeSingle();

  const alreadyAnsweredCorrectly = existingCorrect != null;

  // Save response — upsert so retaking the quiz updates the existing row
  // (the DB has UNIQUE(user_id, question_id) from migration 001)
  const { error: upsertError } = await supabase.from("user_quiz_responses").upsert({
    user_id: user.id,
    question_id,
    selected_option,
    is_correct,
    answered_at: new Date().toISOString(),
    session_id: sessionId,
  }, { onConflict: "user_id,question_id" });
  if (upsertError) {
    console.error("[quiz] upsert failed:", upsertError);
    return NextResponse.json({ error: t("answerSaveFailed") }, { status: 500 });
  }

  let stars_earned = 0;
  const medals_earned: string[] = [];

  if (is_correct && !alreadyAnsweredCorrectly) {
    stars_earned = POINTS_PER_CORRECT;

    // Upsert user_stats
    const toIL = (d: Date) => d.toLocaleDateString("sv", { timeZone: "Asia/Jerusalem" });
    const today = toIL(new Date());

    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!stats) {
      const { error: statsError } = await supabase.from("user_stats").insert({
        user_id: user.id,
        star_points: POINTS_PER_CORRECT,
        streak_days: 1,
        last_active_date: today,
      });
      if (statsError) console.error("[quiz] stats insert failed:", statsError);
    } else {
      const yesterdayStr = toIL(new Date(Date.now() - 86_400_000));

      const newStreak = computeNewStreak(
        stats.streak_days,
        stats.last_active_date,
        today,
        yesterdayStr
      );

      const { error: statsError } = await supabase
        .from("user_stats")
        .update({
          star_points: stats.star_points + POINTS_PER_CORRECT,
          streak_days: newStreak,
          last_active_date: today,
        })
        .eq("user_id", user.id);
      if (statsError) console.error("[quiz] stats update failed:", statsError);

      // Streak milestone medals
      if (isMilestoneReached(newStreak, stats.streak_days, STREAK_MILESTONES)) {
        const slug = `streak-${newStreak}`;
        const { error } = await supabase
          .from("user_medals")
          .insert({ user_id: user.id, medal_slug: slug });
        if (!error) medals_earned.push(slug);
      }
    }
  }

  // Update topic progress if topic_id provided
  let topic_completed = false;

  if (topicId && is_correct) {
    const { data: progress } = await supabase
      .from("user_topic_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("topic_id", topicId)
      .single();

    if (!progress) {
      const { error: progressError } = await supabase.from("user_topic_progress").insert({
        user_id: user.id,
        topic_id: topicId,
        status: "in_progress",
        last_studied_at: new Date().toISOString(),
      });
      if (progressError) console.error("[quiz] topic progress insert failed:", progressError);
    } else if (progress.status !== "completed") {
      const { error: progressError } = await supabase
        .from("user_topic_progress")
        .update({
          status: "in_progress",
          last_studied_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("topic_id", topicId);
      if (progressError) console.error("[quiz] topic progress update failed:", progressError);
    }

    if (!progress || progress.status !== "completed") {
      const isComplete = await checkTopicCompletion(supabase, user.id, topicId);
      if (isComplete) {
        topic_completed = true;
        try {
          await markTopicCompleted(supabase, user.id, topicId);
        } catch (err) {
          console.error("[quiz] Failed to mark topic completed:", err);
        }
      }
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
    topic_completed,
  });
}
