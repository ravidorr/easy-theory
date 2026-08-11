import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    __dirname,
    "../../../../../seeds/migrations/039_active_content_completion_and_idempotent_srs.sql"
  ),
  "utf8"
);

describe("active content completion and idempotent SRS migration", () => {
  it("recomputes completion against the active bank before promoting eligible learners", () => {
    expect(migrationSql).toMatch(
      /UPDATE public\.user_topic_progress AS progress[\s\S]*status = 'in_progress'[\s\S]*active_questions\.is_active/i
    );
    expect(migrationSql).toMatch(
      /CREATE TRIGGER reconcile_topic_progress_for_active_questions[\s\S]*AFTER UPDATE OF is_active ON public\.questions[\s\S]*FOR EACH STATEMENT/i
    );
    expect(migrationSql).toMatch(
      /FUNCTION public\.reconcile_topic_progress_for_active_questions\(\)[\s\S]*WITH active_topic_completions[\s\S]*ON CONFLICT \(user_id, topic_id\) DO UPDATE[\s\S]*INSERT INTO public\.user_medals/i
    );
    expect(migrationSql).toMatch(
      /WITH active_topic_completions[\s\S]*questions\.is_active[\s\S]*BOOL_AND\(responses\.is_correct\)/i
    );
    expect(migrationSql).toMatch(
      /v_active_question_count[\s\S]*WHERE topic_id = p_topic_id[\s\S]*AND is_active/i
    );
    expect(migrationSql).toMatch(
      /submit_quiz_answer_internal[\s\S]*v_topic_question_count[\s\S]*WHERE topic_id = v_topic_id[\s\S]*AND is_active/i
    );
    expect(migrationSql).toMatch(
      /questions\.topic_id = p_topic_id[\s\S]*AND questions\.is_active/i
    );
    expect(migrationSql).toMatch(
      /FROM public\.topics AS topics[\s\S]*FROM public\.questions[\s\S]*topic_id = topics\.id[\s\S]*AND is_active/i
    );
  });

  it("applies SRS atomically with the first submission and returns a replay marker", () => {
    expect(migrationSql).toMatch(
      /SELECT EXISTS[\s\S]*FROM public\.quiz_answer_submissions[\s\S]*INTO v_is_replay/i
    );
    expect(migrationSql).toMatch(
      /RETURN jsonb_set\(v_result, '\{is_new_submission\}', to_jsonb\(NOT v_is_replay\)\)/i
    );
    expect(migrationSql).toMatch(
      /IF NOT v_is_replay[\s\S]*FROM public\.user_srs_cards[\s\S]*ON CONFLICT \(user_id, question_id\) DO UPDATE/i
    );
    expect(migrationSql).toContain("VALUES (39, '039_active_content_completion_and_idempotent_srs.sql'");
  });
});
