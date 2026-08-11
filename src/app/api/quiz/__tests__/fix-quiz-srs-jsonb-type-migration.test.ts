import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    __dirname,
    "../../../../../seeds/migrations/040_fix_quiz_srs_jsonb_type.sql"
  ),
  "utf8"
);

describe("quiz SRS JSONB type migration", () => {
  it("uses PostgreSQL's jsonb_typeof predicate before applying SRS", () => {
    expect(migrationSql).toContain("jsonb_typeof(v_result -> 'is_correct') = 'boolean'");
    expect(migrationSql).not.toMatch(/(^|[^a-z_])typeof\(v_result -> 'is_correct'\)/i);
    expect(migrationSql).toContain("VALUES (40, '040_fix_quiz_srs_jsonb_type.sql'");
  });
});
