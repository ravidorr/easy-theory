import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "../../../../../seeds/migrations/019_protect_achievement_medals.sql"
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf-8") : "";

describe("achievement medal protection migration", () => {
  it("removes client writes to user_medals", () => {
    expect(migrationSql).toMatch(/DROP POLICY IF EXISTS "own insert" ON public\.user_medals/i);
    expect(migrationSql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON TABLE public\.user_medals FROM authenticated/i);
  });

  it("restricts exam evidence and medal writes to the service scorer", () => {
    expect(migrationSql).toMatch(/DROP POLICY IF EXISTS "own insert" ON public\.user_exam_attempts/i);
    expect(migrationSql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.user_exam_attempts FROM authenticated/i
    );
    expect(migrationSql).toMatch(
      /CREATE FUNCTION public\.award_exam_pass_medal\(p_user_id UUID\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/i
    );
    expect(migrationSql).toMatch(
      /FROM public\.user_exam_attempts[\s\S]*user_id = p_user_id[\s\S]*passed = TRUE/i
    );
    expect(migrationSql).toMatch(/RAISE EXCEPTION 'exam_not_passed'/i);
    expect(migrationSql).toMatch(
      /INSERT INTO public\.user_medals[\s\S]*'exam-pass'[\s\S]*ON CONFLICT \(user_id, medal_slug\) DO NOTHING/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.award_exam_pass_medal\(UUID\) FROM anon, authenticated/i
    );
    expect(migrationSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.award_exam_pass_medal\(UUID\) TO service_role/i);
  });
});
