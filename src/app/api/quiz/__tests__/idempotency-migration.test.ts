import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "../../../../../seeds/migrations/010_quiz_submission_idempotency.sql"
);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf-8")
  : "";

function applyRewardLedgerContract(
  ledger: Set<string>,
  userId: string,
  questionId: string,
  isCorrect: boolean
) {
  if (!isCorrect) return 0;

  const rewardKey = `${userId}:${questionId}`;
  if (ledger.has(rewardKey)) return 0;

  ledger.add(rewardKey);
  return 10;
}

// The repository has no local Postgres or Supabase integration harness.
// These checks pin the concurrency, replay, and privilege guarantees without
// adding a database dependency or connecting to a live project.
describe("quiz submission idempotency migration", () => {
  it("stores one immutable logical result per user and idempotency key", () => {
    expect(migrationSql).toMatch(
      /PRIMARY KEY\s*\(\s*user_id\s*,\s*idempotency_key\s*\)/i
    );
    expect(migrationSql).toMatch(
      /INSERT INTO public\.quiz_answer_submissions[\s\S]*ON CONFLICT\s*\(\s*user_id\s*,\s*idempotency_key\s*\)\s*DO NOTHING/i
    );
    expect(migrationSql).toMatch(
      /IF NOT v_claimed THEN[\s\S]*idempotency_key_conflict[\s\S]*IF v_existing_result IS NULL[\s\S]*RETURN v_existing_result/i
    );
    expect(migrationSql.indexOf("RETURN v_existing_result")).toBeLessThan(
      migrationSql.indexOf("pg_advisory_xact_lock")
    );
  });

  it("replays before applying a fixed database rate limit to new submissions", () => {
    expect(migrationSql).toMatch(
      /CREATE TABLE public\.quiz_submission_rate_limits[\s\S]*user_id UUID PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/i
    );
    expect(migrationSql).toMatch(
      /INSERT INTO public\.quiz_submission_rate_limits\s*\(\s*user_id[\s\S]*VALUES\s*\(\s*v_user_id[\s\S]*ON CONFLICT \(user_id\)[\s\S]*INTERVAL '60 seconds'[\s\S]*quiz_submission_rate_limits\.count < 20[\s\S]*IF v_row_count = 0 THEN[\s\S]*RAISE EXCEPTION 'rate_limited'/i
    );
    expect(migrationSql).toMatch(
      /ALTER TABLE public\.quiz_submission_rate_limits ENABLE ROW LEVEL SECURITY[\s\S]*REVOKE ALL ON TABLE public\.quiz_submission_rate_limits FROM anon, authenticated/i
    );

    const replayIndex = migrationSql.indexOf("RETURN v_existing_result");
    const rateLimitIndex = migrationSql.indexOf(
      "INSERT INTO public.quiz_submission_rate_limits"
    );
    const answerWriteIndex = migrationSql.indexOf(
      "INSERT INTO public.user_quiz_responses"
    );
    expect(replayIndex).toBeLessThan(rateLimitIndex);
    expect(rateLimitIndex).toBeLessThan(answerWriteIndex);
    expect(migrationSql).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it("awards each authenticated user and question only once", () => {
    expect(migrationSql).toMatch(
      /CREATE TABLE public\.quiz_question_rewards\s*\([\s\S]*user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE[\s\S]*question_id UUID NOT NULL REFERENCES public\.questions\(id\) ON DELETE CASCADE[\s\S]*PRIMARY KEY\s*\(\s*user_id\s*,\s*question_id\s*\)/i
    );
    expect(migrationSql).toMatch(
      /INSERT INTO public\.quiz_question_rewards\s*\(\s*user_id\s*,\s*question_id\s*\)[\s\S]*ON CONFLICT\s*\(\s*user_id\s*,\s*question_id\s*\)\s*DO NOTHING\s*;[\s\S]*GET DIAGNOSTICS v_row_count = ROW_COUNT\s*;[\s\S]*v_reward_awarded := v_row_count = 1/i
    );
    expect(migrationSql).toMatch(
      /'stars_earned'\s*,\s*CASE WHEN v_reward_awarded THEN 10 ELSE 0 END/i
    );

    const ledger = new Set<string>();
    const rewards = [
      applyRewardLedgerContract(ledger, "user-1", "question-1", true),
      applyRewardLedgerContract(ledger, "user-1", "question-1", false),
      applyRewardLedgerContract(ledger, "user-1", "question-1", true),
    ];

    expect(rewards).toEqual([10, 0, 0]);
  });

  it("backfills and protects the immutable reward ledger", () => {
    expect(migrationSql).toMatch(
      /INSERT INTO public\.quiz_question_rewards\s*\(\s*user_id\s*,\s*question_id\s*\)\s*SELECT user_id, question_id\s*FROM public\.user_quiz_responses\s*WHERE is_correct = TRUE\s*ON CONFLICT\s*\(\s*user_id\s*,\s*question_id\s*\)\s*DO NOTHING/i
    );
    expect(migrationSql).toMatch(
      /ALTER TABLE public\.quiz_question_rewards ENABLE ROW LEVEL SECURITY/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON TABLE public\.quiz_question_rewards FROM PUBLIC/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON TABLE public\.quiz_question_rewards FROM anon, authenticated/i
    );
  });

  it("shares the cleanup ceiling between rate limits and submissions", () => {
    expect(migrationSql).toMatch(
      /CREATE INDEX quiz_answer_submissions_created_at_idx[\s\S]*ON public\.quiz_answer_submissions\s*\(\s*created_at\s*\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE INDEX quiz_submission_rate_limits_window_start_idx[\s\S]*ON public\.quiz_submission_rate_limits\s*\(\s*window_start\s*\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.cleanup_quiz_submission_state\(\s*p_batch_size INTEGER DEFAULT 1000\s*,\s*p_max_rows INTEGER DEFAULT 10000\s*\)[\s\S]*RETURNS INTEGER/i
    );
    expect(migrationSql).toMatch(
      /WHILE v_deleted_total < p_max_rows LOOP[\s\S]*FROM public\.quiz_submission_rate_limits[\s\S]*ORDER BY window_start[\s\S]*LIMIT LEAST\(\s*p_batch_size\s*,\s*p_max_rows - v_deleted_total\s*\)[\s\S]*FOR UPDATE SKIP LOCKED[\s\S]*v_deleted_total := v_deleted_total \+ v_batch_deleted/i
    );
    expect(migrationSql).toMatch(
      /WHILE v_deleted_total < p_max_rows LOOP[\s\S]*FROM public\.quiz_answer_submissions[\s\S]*ORDER BY created_at[\s\S]*LIMIT LEAST\(\s*p_batch_size\s*,\s*p_max_rows - v_deleted_total\s*\)[\s\S]*FOR UPDATE SKIP LOCKED[\s\S]*v_deleted_total := v_deleted_total \+ v_batch_deleted/i
    );
    const rateLimitLoopIndex = migrationSql.indexOf(
      "FROM public.quiz_submission_rate_limits",
      migrationSql.indexOf("CREATE OR REPLACE FUNCTION public.cleanup_quiz_submission_state")
    );
    const submissionLoopIndex = migrationSql.indexOf(
      "FROM public.quiz_answer_submissions",
      migrationSql.indexOf("CREATE OR REPLACE FUNCTION public.cleanup_quiz_submission_state")
    );
    expect(rateLimitLoopIndex).toBeLessThan(submissionLoopIndex);
    expect(migrationSql).toMatch(
      /IF p_max_rows < 2 OR p_max_rows > 50000[\s\S]*invalid_cleanup_max_rows/i
    );
  });

  it("schedules least-privilege cleanup through pg_cron", () => {
    expect(migrationSql).toMatch(
      /CREATE EXTENSION IF NOT EXISTS pg_cron\s*;/i
    );
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.cleanup_quiz_submission_state[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.cleanup_quiz_submission_state\(INTEGER, INTEGER\)\s+FROM PUBLIC/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.cleanup_quiz_submission_state\(INTEGER, INTEGER\)\s+FROM anon, authenticated/i
    );
    expect(migrationSql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.cleanup_quiz_submission_state/
    );
    expect(migrationSql).toMatch(
      /cron\.schedule\(\s*'cleanup-quiz-submission-state'\s*,\s*'\* \* \* \* \*'\s*,[\s\S]*SELECT public\.cleanup_quiz_submission_state\(1000,\s*10000\)/i
    );
  });

  it("serializes answer transitions and keeps all side effects in one RPC transaction", () => {
    expect(migrationSql).toMatch(
      /pg_advisory_xact_lock\([\s\S]*:question:/i
    );
    expect(migrationSql).toMatch(/pg_advisory_xact_lock\([\s\S]*:topic:/i);
    expect(migrationSql).toMatch(
      /UPDATE public\.user_quiz_responses[\s\S]*is_correct = FALSE[\s\S]*RETURNING/i
    );
    expect(migrationSql).toMatch(/UPDATE public\.user_stats[\s\S]*star_points/i);
    expect(migrationSql).toMatch(
      /INSERT INTO public\.user_medals[\s\S]*ON CONFLICT/i
    );
    expect(migrationSql).toMatch(
      /UPDATE public\.user_topic_progress[\s\S]*completed/i
    );
    expect(migrationSql).toMatch(
      /UPDATE public\.quiz_answer_submissions[\s\S]*SET result = v_result/i
    );
    expect(migrationSql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      migrationSql.indexOf("UPDATE public.quiz_answer_submissions")
    );
  });

  it("derives topic identity from the question before any side effect", () => {
    expect(migrationSql).toMatch(
      /SELECT correct_option, explanation_he, topic_id[\s\S]*INTO v_correct_option, v_explanation_he, v_question_topic_id[\s\S]*FROM public\.questions/i
    );
    expect(migrationSql).toMatch(
      /p_topic_id IS DISTINCT FROM v_question_topic_id[\s\S]*topic_question_mismatch/i
    );
    expect(migrationSql.indexOf("topic_question_mismatch")).toBeLessThan(
      migrationSql.indexOf("INSERT INTO public.quiz_answer_submissions")
    );
    expect(migrationSql).toMatch(
      /IF v_topic_id IS NOT NULL AND v_is_correct THEN[\s\S]*topic_id = v_topic_id/i
    );
  });

  it("derives identity from auth and exposes only the RPC to authenticated clients", () => {
    expect(migrationSql).toMatch(/v_user_id UUID := auth\.uid\(\)/i);
    expect(migrationSql).toMatch(
      /ALTER TABLE public\.quiz_answer_submissions ENABLE ROW LEVEL SECURITY/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON TABLE public\.quiz_answer_submissions FROM anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /SECURITY DEFINER[\s\S]*SET search_path = ''/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.submit_quiz_answer[\s\S]*FROM PUBLIC/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.submit_quiz_answer[\s\S]*FROM anon/i
    );
    expect(migrationSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.submit_quiz_answer[\s\S]*TO authenticated/i
    );
    expect(migrationSql).not.toMatch(/\bp_user_id\b/i);
  });
});
