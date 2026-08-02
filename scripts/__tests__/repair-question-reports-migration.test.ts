import { readFileSync } from "node:fs";

const migration = readFileSync("seeds/migrations/038_repair_question_reports.sql", "utf8");

describe("question reports repair migration", () => {
  it("recreates the missing table with the current report schema", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.question_reports/);
    expect(migration).toMatch(/user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(migration).toMatch(/question_id UUID NOT NULL REFERENCES public\.questions\(id\)/);
    expect(migration).toMatch(/UNIQUE \(user_id, question_id\)/);
    expect(migration).toMatch(/category TEXT NOT NULL DEFAULT 'unclear'/);
    expect(migration).toMatch(/source_checksum TEXT/);
    expect(migration).toMatch(/ALTER TABLE public\.question_reports ENABLE ROW LEVEL SECURITY/);
  });

  it("is safe for a database where v26 created the table but v28 columns are absent", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'unclear'/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS source_checksum TEXT/);
    expect(migration).toContain("VALUES (38, '038_repair_question_reports.sql'");
  });
});
