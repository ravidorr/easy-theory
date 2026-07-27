import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(__dirname, "../../../../../seeds/migrations/033_remove_answer_confidence.sql"),
  "utf-8"
);

describe("answer confidence removal migration", () => {
  it("permanently removes the unused confidence table and records itself", () => {
    expect(migrationSql).toMatch(/DROP TABLE public\.user_answer_confidence;/i);
    expect(migrationSql).toMatch(
      /VALUES \(33, '033_remove_answer_confidence\.sql', '[a-f0-9]{64}'\);/i
    );
  });
});
