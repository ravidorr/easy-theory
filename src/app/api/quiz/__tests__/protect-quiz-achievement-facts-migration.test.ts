import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "../../../../../seeds/migrations/021_protect_quiz_achievement_facts.sql"
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf-8") : "";

describe("quiz achievement fact protection migration", () => {
  it("removes client writes to quiz facts and their progress projection", () => {
    for (const table of ["user_quiz_responses", "user_topic_progress"]) {
      expect(migrationSql).toMatch(
        new RegExp(`DROP POLICY IF EXISTS "own insert" ON public\\.${table}`, "i")
      );
      expect(migrationSql).toMatch(
        new RegExp(`DROP POLICY IF EXISTS "own update" ON public\\.${table}`, "i")
      );
      expect(migrationSql).toMatch(
        new RegExp(`REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${table} FROM authenticated`, "i")
      );
    }
  });
});
