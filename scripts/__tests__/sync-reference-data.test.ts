import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyPlan,
  buildPlansFromRows,
  buildTablePlan,
  collectQaBackupData,
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

  it("allocates one QA topic ID for a new topic and its questions", async () => {
    const allocatedTopicId = "00000000-0000-4000-8000-000000000001";
    const plans = buildPlansFromRows(
      new Map([
        ["topics", [{ id: "prod-new", slug: "new-topic", name_he: "New topic" }]],
        [
          "questions",
          [
            {
              id: "prod-question",
              topic_id: "prod-new",
              question_number: 1,
              question_he: "Question",
            },
          ],
        ],
      ]),
      new Map([
        ["topics", []],
        ["questions", []],
      ]),
      () => allocatedTopicId
    );

    const topicInsert = plans.find((plan) => plan.table === "topics")!.inserts[0];
    const questionInsert = plans.find((plan) => plan.table === "questions")!.inserts[0];
    expect(topicInsert.payload.id).toBe(allocatedTopicId);
    expect(questionInsert.payload.topic_id).toBe(allocatedTopicId);

    const applied: SyncOperation[] = [];
    await applyPlan(
      {
        label: "QA",
        url: "https://qa.example.test",
        serviceRoleKey: "qa-secret",
      },
      plans,
      async (operation) => {
        applied.push(operation);
      }
    );

    expect(applied.indexOf(topicInsert)).toBeLessThan(applied.indexOf(questionInsert));
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

  it("collects backups exclusively from QA", async () => {
    const requestedUrls: string[] = [];
    const mock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      requestedUrls.push(url);
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const backup = await collectQaBackupData(
      {
        label: "QA",
        url: "https://qa.example.test",
        serviceRoleKey: "qa-secret",
      },
      mock
    );

    expect(requestedUrls).toHaveLength(6);
    expect(requestedUrls.every((url) => url.startsWith("https://qa.example.test/"))).toBe(true);
    expect(backup).toEqual({
      qa: {
        user_srs_cards: [],
        referenceData: {
          topics: [],
          signs: [],
          videos: [],
          resources: [],
          questions: [],
        },
      },
    });
    expect(backup).not.toHaveProperty("production");
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
