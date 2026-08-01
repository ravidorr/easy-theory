import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    __dirname,
    "../../../../../seeds/migrations/037_retire_streak14_and_questions100_achievements.sql"
  ),
  "utf-8"
);

describe("retired achievement migration", () => {
  it("limits new streak medals to the three supported milestones", () => {
    expect(migrationSql).toMatch(/v_new_streak = ANY \(ARRAY\[3, 7, 30\]\)/);
    expect(migrationSql).not.toMatch(/ARRAY\[3, 7, 14, 30\]/);
  });

  it("removes the 100-question award while preserving topic achievements", () => {
    expect(migrationSql).not.toContain("questions-100");
    expect(migrationSql).toContain("'first-topic'");
    expect(migrationSql).toContain("'all-topics'");
    expect(migrationSql).toMatch(/pg_advisory_xact_lock\(hashtextextended\(v_user_id::TEXT \|\| ':achievements'/);
  });
});
