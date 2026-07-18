import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "../../../../../seeds/migrations/018_questions_achievement_serialization.sql"
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf-8") : "";

describe("questions-100 achievement migration", () => {
  it("serializes each learner before counting a newly inserted response", () => {
    expect(migrationSql).toMatch(
      /ALTER FUNCTION public\.submit_quiz_answer\(TEXT, UUID, TEXT, UUID, UUID\)\s+RENAME TO submit_quiz_answer_internal/i
    );
    expect(migrationSql).toMatch(/pg_advisory_xact_lock\(hashtextextended\(v_user_id::TEXT \|\| ':achievements'/i);
    expect(migrationSql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      migrationSql.indexOf("public.submit_quiz_answer_internal")
    );
    expect(migrationSql).toMatch(
      /SELECT EXISTS[\s\S]*FROM public\.user_quiz_responses[\s\S]*INTO v_response_existed/i
    );
    expect(migrationSql).toMatch(
      /IF NOT v_response_existed THEN[\s\S]*SELECT COUNT\(\*\)[\s\S]*IF v_answer_count = 100/i
    );
  });

  it("awards and returns the threshold medal exactly once at the crossing", () => {
    expect(migrationSql).toMatch(
      /INSERT INTO public\.user_medals \(user_id, medal_slug\)[\s\S]*'questions-100'[\s\S]*ON CONFLICT \(user_id, medal_slug\) DO NOTHING[\s\S]*RETURNING medal_slug/i
    );
    expect(migrationSql).toMatch(
      /jsonb_set\([\s\S]*'\{medals_earned\}'[\s\S]*jsonb_build_array\(v_medal_slug\)/i
    );
    expect(migrationSql).toMatch(
      /UPDATE public\.quiz_answer_submissions[\s\S]*SET result = v_result/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.submit_quiz_answer_internal[\s\S]*FROM anon, authenticated/i
    );
  });

  it("evaluates first-topic and all-topics in the serialized completion transaction", () => {
    expect(migrationSql).toMatch(
      /IF COALESCE\(\(v_result ->> 'topic_completed'\)::BOOLEAN, FALSE\) THEN/i
    );
    expect(migrationSql).toMatch(
      /IF v_completed_topic_count = 1 THEN[\s\S]*VALUES \(v_user_id, 'first-topic'\)[\s\S]*ON CONFLICT \(user_id, medal_slug\) DO NOTHING/i
    );
    expect(migrationSql).toMatch(
      /SELECT COUNT\(\*\) INTO v_topic_count FROM public\.topics[\s\S]*SELECT COUNT\(\*[\s\S]*FROM public\.user_topic_progress[\s\S]*status = 'completed'/i
    );
    expect(migrationSql).toMatch(
      /v_topic_count > 0 AND v_completed_topic_count >= v_topic_count[\s\S]*VALUES \(v_user_id, 'all-topics'\)/i
    );
  });
});
