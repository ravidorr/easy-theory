import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "../../../../../seeds/migrations/017_quiz_answer_events.sql"
);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf-8")
  : "";

describe("quiz answer events migration", () => {
  it("stores an append-only, time-indexed event for each response mutation", () => {
    expect(migrationSql).toMatch(
      /CREATE TABLE public\.quiz_answer_events\s*\([\s\S]*user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE[\s\S]*question_id UUID NOT NULL REFERENCES public\.questions\(id\) ON DELETE CASCADE[\s\S]*is_correct BOOLEAN NOT NULL[\s\S]*answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/i
    );
    expect(migrationSql).toMatch(
      /CREATE INDEX quiz_answer_events_user_answered_at_idx[\s\S]*ON public\.quiz_answer_events\s*\(user_id, answered_at\)/i
    );
    expect(migrationSql).toMatch(
      /AFTER INSERT OR UPDATE OF selected_option, is_correct, answered_at, session_id[\s\S]*ON public\.user_quiz_responses[\s\S]*EXECUTE FUNCTION public\.record_quiz_answer_event\(\)/i
    );
  });

  it("permits only authenticated users to read their own events", () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE public\.quiz_answer_events ENABLE ROW LEVEL SECURITY/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON TABLE public\.quiz_answer_events FROM anon, authenticated/i
    );
    expect(migrationSql).toMatch(
      /CREATE POLICY "own select" ON public\.quiz_answer_events[\s\S]*FOR SELECT USING \(user_id = auth\.uid\(\)\)/i
    );
    expect(migrationSql).toMatch(
      /GRANT SELECT ON TABLE public\.quiz_answer_events TO authenticated/i
    );
  });

  it("allows only the quiz RPC to mutate response rows", () => {
    expect(migrationSql).toMatch(
      /DROP POLICY IF EXISTS "own insert" ON public\.user_quiz_responses/i
    );
    expect(migrationSql).toMatch(
      /DROP POLICY IF EXISTS "own update" ON public\.user_quiz_responses/i
    );
  });

  it("keeps event writes inside the answer transaction", () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_quiz_answer_event\(\)[\s\S]*INSERT INTO public\.quiz_answer_events[\s\S]*NEW\.user_id[\s\S]*NEW\.question_id[\s\S]*NEW\.is_correct[\s\S]*NEW\.answered_at/i
    );
    expect(migrationSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.record_quiz_answer_event\(\) FROM anon, authenticated/i
    );
  });
});
