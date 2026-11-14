import { readFileSync } from "node:fs";

const migration = readFileSync("seeds/migrations/036_content_release_provenance.sql", "utf8");

describe("content release migration", () => {
  it("adds active/provenance fields and blocks answers to retired questions", () => {
    expect(migration).toMatch(/questions[\s\S]*source_release_id UUID[\s\S]*is_active BOOLEAN/i);
    expect(migration).toMatch(/signs[\s\S]*source_release_id UUID[\s\S]*is_active BOOLEAN/i);
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE ON public\.user_quiz_responses/i);
  });

  it("publishes atomically, removes uncited explanations, and expires exams", () => {
    expect(migration).toMatch(/FUNCTION public\.publish_content_release/i);
    expect(migration).toMatch(/explanation_he = CASE WHEN explanation_he_source_url IS NULL THEN NULL/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ/i);
    expect(migration).toMatch(/exam_session_invalidated/i);
    expect(migration).toMatch(/UPDATE public\.user_exam_sessions[\s\S]*invalidated_at = NOW\(\)/i);
  });

  it("preserves the per-user advisory lock when creating exams", () => {
    expect(migration).toMatch(/pg_advisory_xact_lock\(hashtext\(v_user_id::TEXT\)\)/i);
  });
});
