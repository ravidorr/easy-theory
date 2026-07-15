import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { SIGNS_QUESTION_15_AR } from "@/lib/content/signs-question-15-ar";

const migrationPath = resolve(
  __dirname,
  "../015_signs_question_15_arabic.sql"
);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf-8")
  : "";

describe("015_signs_question_15_arabic migration", () => {
  it("updates signs question 15 with Arabic question and option text", () => {
    expect(migrationSql).toMatch(/question_number = 15/i);
    expect(migrationSql).toMatch(/slug = 'signs'/i);
    expect(migrationSql).toContain(SIGNS_QUESTION_15_AR.question_ar);
    expect(migrationSql).toContain(SIGNS_QUESTION_15_AR.option_a_ar);
    expect(migrationSql).toContain(SIGNS_QUESTION_15_AR.option_b_ar);
    expect(migrationSql).toContain(SIGNS_QUESTION_15_AR.option_c_ar);
    expect(migrationSql).toContain(SIGNS_QUESTION_15_AR.option_d_ar);
  });
});
