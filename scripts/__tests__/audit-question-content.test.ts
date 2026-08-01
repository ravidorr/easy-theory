import { describe, expect, it, vi } from "vitest";
import {
  compareQuestions,
  fetchAllRows,
  fetchQuestionsForAudit,
  normalizeText,
  optionsFromArgs,
  parseMinistryQuestions,
  renderMarkdown,
  verifyPinnedQuestionBankChecksum,
  type AuditReport,
} from "../audit-question-content";
import type { DatabaseConfig } from "../compare-databases";

const config: DatabaseConfig = {
  label: "QA",
  url: "https://qa.example.test",
  serviceRoleKey: "secret",
};

function ministryItem(number: string, correctId: string, options: string[] = ["א", "ב", "ג", "ד"]): string {
  return `<item><title>${number}. שאלה &amp; חשובה</title><description><![CDATA[<ul>${options.map((option, index) => `<li><span${index === 1 ? ` id="correctAnswer${correctId}"` : ""}>${option}</span></li>`).join("")}</ul><span>| «В» |</span>]]></description><category>חוקי התנועה</category></item>`;
}

function databaseQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "question-id",
    topic_id: "topic-id",
    question_number: 693,
    question_he: "שאלה & חשובה",
    option_a: "א",
    option_b: "ב",
    option_c: "ג",
    option_d: "ד",
    correct_option: "b",
    is_active: true,
    ...overrides,
  };
}

describe("Ministry question audit", () => {
  it("requires the Ministry XML to match the pinned question-bank checksum", () => {
    const xml = "<rss>official source</rss>";
    const checksum = "240e2163bff835e5e8ff5700433af3db0e82a9257fb8aced78752fa809fee4c1";

    expect(verifyPinnedQuestionBankChecksum(xml, {
      sources: [{ kind: "question_bank", sourceChecksum: checksum }],
    })).toBe(checksum);
    expect(() => verifyPinnedQuestionBankChecksum(xml, {
      sources: [{ kind: "question_bank", sourceChecksum: "stale" }],
    })).toThrow(/does not match the pinned question_bank checksum/);
  });

  it("accepts pnpm's forwarded argument separator", () => {
    expect(optionsFromArgs(["--", "--env", ".env.qa", "--target", "QA", "--output", ".context/audit"])).toEqual({
      envPath: ".env.qa",
      target: "QA",
      outputDir: ".context/audit",
    });
  });

  it("independently parses ordered options and normal or zero-padded correct-answer markers", () => {
    const questions = parseMinistryQuestions(`<rss><channel>${ministryItem("0693", "0693")}${ministryItem("1759", "1759")}</channel></rss>`);

    expect(questions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        questionNumber: 693,
        topicSlug: "traffic-laws",
        question: "שאלה & חשובה",
        options: ["א", "ב", "ג", "ד"],
        correctOption: "b",
      }),
      expect.objectContaining({ questionNumber: 1759, correctOption: "b" }),
    ]));
  });

  it("normalizes HTML entities, tags, quoted attributes, whitespace, and Unicode consistently", () => {
    expect(normalizeText("  <span data-example=\"a > b\">א&nbsp;&amp;  ב</span> \n")).toBe("א & ב");
  });

  it("classifies all content mismatches and inactive source rows", () => {
    const official = parseMinistryQuestions(`<rss><channel>${ministryItem("0693", "0693")}</channel></rss>`);
    const issues = compareQuestions(
      official,
      [
        databaseQuestion({ is_active: false }),
        databaseQuestion({ question_number: 900, id: "extra" }),
        { id: "bad" },
      ],
      new Map([["topic-id", "traffic-laws"]])
    );

    expect(issues.map((issue) => issue.kind)).toEqual(["malformed-row", "inactive-source", "unexpected"]);
  });

  it("reports topic, prompt, option-order, correct-answer, and duplicate failures", () => {
    const official = parseMinistryQuestions(`<rss><channel>${ministryItem("0693", "0693")}</channel></rss>`);
    const issues = compareQuestions(
      official,
      [
        databaseQuestion({ id: "one", topic_id: "wrong", question_he: "שונה", option_a: "ב", option_b: "א", correct_option: "a" }),
        databaseQuestion({ id: "two" }),
      ],
      new Map([["wrong", "signs"], ["topic-id", "traffic-laws"]])
    );

    expect(issues.map((issue) => issue.kind)).toEqual(["duplicate"]);
  });

  it("reports field mismatches when there is one active app row", () => {
    const official = parseMinistryQuestions(`<rss><channel>${ministryItem("0693", "0693")}</channel></rss>`);
    const issues = compareQuestions(
      official,
      [databaseQuestion({ topic_id: "wrong", question_he: "שונה", option_a: "ב", option_b: "א", correct_option: "a" })],
      new Map([["wrong", "signs"]])
    );

    expect(issues.map((issue) => issue.kind)).toEqual(["correct_option", "option-order", "question", "topic"]);
  });

  it("paginates question rows with GET-only requests", async () => {
    const rows = Array.from({ length: 1_273 }, (_, id) => ({ id }));
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const range = new Headers(init?.headers).get("Range") ?? "0-999";
      const [start, end] = range.split("-").map(Number);
      return new Response(JSON.stringify(rows.slice(start, end + 1)), { status: 200 });
    }) as typeof fetch;

    await expect(fetchAllRows(config, "questions", "id", fetchMock)).resolves.toHaveLength(1_273);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchMock).mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });

  it("uses all rows as active only for databases that predate is_active", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.searchParams.get("select")?.includes("is_active")) {
        return new Response(JSON.stringify({
          code: "PGRST204",
          message: "Could not find the 'is_active' column of 'questions' in the schema cache",
        }), { status: 400 });
      }
      return new Response(JSON.stringify([databaseQuestion()]), { status: 200 });
    }) as typeof fetch;

    await expect(fetchQuestionsForAudit(config, fetchMock)).resolves.toEqual({
      activitySource: "legacy-all-rows",
      rows: [databaseQuestion()],
    });
  });

  it("renders every mismatch in the Markdown evidence report", () => {
    const report: AuditReport = {
      generatedAt: "2026-08-01T00:00:00.000Z",
      target: "QA",
      activitySource: "is_active",
      sourceChecksum: "abc",
      officialQuestionCount: 1,
      databaseQuestionCount: 1,
      activeDatabaseQuestionCount: 1,
      comparedQuestionCount: 1,
      mismatchCount: 1,
      mismatches: [{ kind: "correct_option", questionNumber: 693, official: "b", app: "a" }],
    };

    expect(renderMarkdown(report)).toContain("Q693 - correct_option");
    expect(renderMarkdown(report)).toContain("Official: `\"b\"`");
  });
});
