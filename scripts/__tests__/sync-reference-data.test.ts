import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyPlan,
  buildTablePlan,
  type SyncOperation,
  type TableSyncPlan,
} from "../sync-reference-data";

describe("reference data sync planning", () => {
  const productionTopics = [{ id: "prod-signs", slug: "signs", name_he: "Signs" }];
  const qaTopics = [{ id: "qa-signs", slug: "signs", name_he: "Signs" }];

  it("plans updates and inserts by natural key without copying IDs", () => {
    const plan = buildTablePlan(
      "topics",
      [
        { id: "prod-signs", slug: "signs", name_he: "New" },
        { id: "prod-safety", slug: "safety", name_he: "Safety" },
      ],
      [{ id: "qa-signs", slug: "signs", name_he: "Old" }],
      productionTopics,
      qaTopics
    );

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].payload).toEqual({ slug: "signs", name_he: "New" });
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].key).toBe("safety");
  });

  it("maps production question topic IDs to the matching QA topic ID", () => {
    const plan = buildTablePlan(
      "questions",
      [
        {
          id: "prod-question",
          topic_id: "prod-signs",
          question_number: 1,
          question_he: "Question",
        },
      ],
      [
        {
          id: "qa-question",
          topic_id: "qa-signs",
          question_number: 1,
          question_he: "Old question",
        },
      ],
      productionTopics,
      qaTopics
    );

    expect(plan.updates[0].payload).toEqual({
      topic_id: "qa-signs",
      question_number: 1,
      question_he: "Question",
    });
  });

  it("identifies QA-only rows instead of planning destructive deletion", () => {
    const plan = buildTablePlan(
      "signs",
      [{ id: "prod-100", sign_number: "100", name_he: "Sign" }],
      [
        { id: "qa-100", sign_number: "100", name_he: "Sign" },
        { id: "qa-101", sign_number: "101", name_he: "Extra" },
      ],
      productionTopics,
      qaTopics
    );

    expect(plan.qaOnlyKeys).toEqual(["101"]);
    expect(plan.updates).toHaveLength(0);
  });

  it("finishes topic operations before starting question operations", async () => {
    const operation = (table: "topics" | "questions"): SyncOperation => ({
      table,
      keyField: table === "topics" ? "slug" : "question_number",
      key: table === "topics" ? "new-topic" : 1,
      payload: {},
      action: "insert",
    });
    const plan = (table: "topics" | "questions"): TableSyncPlan => ({
      table,
      productionCount: 1,
      qaCount: 0,
      inserts: [operation(table)],
      updates: [],
      qaOnlyKeys: [],
    });
    const started: string[] = [];
    let releaseTopic!: () => void;
    const topicGate = new Promise<void>((resolve) => {
      releaseTopic = resolve;
    });
    const applying = applyPlan(
      {
        label: "QA",
        url: "https://qa.example.test",
        serviceRoleKey: "qa-secret",
      },
      [plan("questions"), plan("topics")],
      async (syncOperation) => {
        started.push(syncOperation.table);
        if (syncOperation.table === "topics") await topicGate;
      }
    );

    await vi.waitFor(() => expect(started).toEqual(["topics"]));
    releaseTopic();
    await applying;

    expect(started).toEqual(["topics", "questions"]);
  });
});

describe("018 SRS ease reconciliation migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "seeds/migrations/018_align_user_srs_ease.sql"),
    "utf8"
  );

  it("rebuilds the floor constraint around a clamped double-precision conversion", () => {
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS user_srs_cards_ease_check/i);
    expect(sql).toMatch(/TYPE DOUBLE PRECISION/i);
    expect(sql).toMatch(/USING GREATEST\(ease::DOUBLE PRECISION, 1\.3::DOUBLE PRECISION\)/i);
    expect(sql).toMatch(/CHECK \(ease >= 1\.3\)/i);
  });
});
