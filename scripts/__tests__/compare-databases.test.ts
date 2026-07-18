import {
  compareDatabases,
  compareOpenApi,
  compareReferenceRows,
  configFromEnv,
  fetchAllRows,
  loadConfigs,
  renderReport,
  validateDistinctProjects,
  type DatabaseConfig,
} from "../compare-databases";

const production: DatabaseConfig = {
  label: "production",
  url: "https://production.example.test",
  serviceRoleKey: "production-secret",
};

const qa: DatabaseConfig = {
  label: "QA",
  url: "https://qa.example.test",
  serviceRoleKey: "qa-secret",
};

function definition(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object", required, properties };
}

function openApi(
  definitions: Record<string, unknown>,
  rpcs: Record<string, { parameters?: unknown[]; responseSchema?: unknown }> = {}
) {
  return {
    swagger: "2.0",
    definitions,
    paths: Object.fromEntries(
      Object.entries(rpcs).map(([name, rpc]) => [
        `/rpc/${name}`,
        {
          post: {
            parameters: rpc.parameters ?? [],
            responses: { 200: { schema: rpc.responseSchema ?? { type: "object" } } },
          },
        },
      ])
    ),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchMock(
  productionSpec: unknown,
  qaSpec: unknown,
  productionRows: Record<string, Array<Record<string, unknown>>> = {},
  qaRows: Record<string, Array<Record<string, unknown>>> = {}
): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    const isProduction = url.hostname === "production.example.test";
    if (url.pathname === "/rest/v1/") {
      return jsonResponse(isProduction ? productionSpec : qaSpec);
    }
    const table = decodeURIComponent(url.pathname.slice("/rest/v1/".length));
    const rows = (isProduction ? productionRows : qaRows)[table] ?? [];
    const range = new Headers(init?.headers).get("Range") ?? "0-999";
    const [start, end] = range.split("-").map(Number);
    return jsonResponse(rows.slice(start, end + 1));
  }) as typeof fetch;
}

describe("database configuration", () => {
  it("requires URLs, service-role credentials, and the QA marker", () => {
    expect(() => configFromEnv({}, "production")).toThrow(/must define/);
    expect(() =>
      configFromEnv(
        {
          NEXT_PUBLIC_SUPABASE_URL: qa.url,
          SUPABASE_SERVICE_ROLE_KEY: qa.serviceRoleKey,
        },
        "QA"
      )
    ).toThrow(/QA_ENV=1/);
  });

  it("rejects identical production and QA projects", () => {
    expect(() =>
      validateDistinctProjects(production, { ...qa, url: production.url })
    ).toThrow(/same Supabase project/);
  });

  it("loads the protected CI environment without local env files", () => {
    vi.stubEnv("PROD_SUPABASE_URL", production.url);
    vi.stubEnv("PROD_SUPABASE_SERVICE_ROLE_KEY", production.serviceRoleKey);
    vi.stubEnv("QA_SUPABASE_URL", qa.url);
    vi.stubEnv("QA_SUPABASE_SERVICE_ROLE_KEY", qa.serviceRoleKey);

    expect(loadConfigs("missing-production", "missing-qa")).toEqual({ production, qa });

    vi.unstubAllEnvs();
  });
});

describe("OpenAPI comparison", () => {
  it("reports missing tables, column metadata changes, and RPC signature changes", () => {
    const productionSpec = openApi(
      {
        topics: definition({ slug: { type: "string" } }, ["slug"]),
        user_srs_cards: definition({ ease: { type: "number", format: "real", default: 2.5 } }),
      },
      {
        submit_quiz_answer: {
          parameters: [{ name: "body", in: "body", required: true, schema: { type: "object" } }],
        },
      }
    );
    const qaSpec = openApi(
      {
        topics: definition({ slug: { type: "string" } }, ["slug"]),
        videos: definition({ youtube_id: { type: "string" } }, ["youtube_id"]),
        user_srs_cards: definition({
          ease: { type: "number", format: "double precision", default: 2.5 },
        }),
      },
      {
        submit_quiz_answer: {
          parameters: [
            { name: "body", in: "body", required: true, schema: { type: "array" } },
          ],
        },
      }
    );

    const result = compareOpenApi(productionSpec, qaSpec);

    expect(result.qaOnlyTables).toEqual(["videos"]);
    expect(result.changedTables.user_srs_cards).toContainEqual({
      path: "properties.ease.format",
      production: "real",
      qa: "double precision",
    });
    expect(result.changedRpcs.submit_quiz_answer).toHaveLength(1);
  });
});

describe("reference data comparison", () => {
  it("groups additions, removals, and changed fields by stable key", () => {
    const result = compareReferenceRows(
      "topics",
      [
        { slug: "signs", name_he: "old" },
        { slug: "safety", name_he: "same" },
      ],
      [
        { slug: "signs", name_he: "new" },
        { slug: "vehicle", name_he: "vehicle" },
      ]
    );

    expect(result.productionOnlyKeys).toEqual(["safety"]);
    expect(result.qaOnlyKeys).toEqual(["vehicle"]);
    expect(result.changedRows).toEqual([{ key: "signs", columns: ["name_he"] }]);
    expect(result.changedColumnCounts).toEqual({ name_he: 1 });
  });

  it("normalizes generated IDs and question topic IDs through each environment's slug", async () => {
    const definitions = {
      topics: definition({ id: { type: "string" }, slug: { type: "string" } }),
      questions: definition({
        id: { type: "string" },
        topic_id: { type: "string" },
        question_number: { type: "integer" },
        question_he: { type: "string" },
      }),
      signs: definition({ id: { type: "string" }, sign_number: { type: "string" } }),
      videos: definition({ id: { type: "string" }, youtube_id: { type: "string" } }),
      resources: definition({ id: { type: "string" }, href: { type: "string" } }),
    };
    const spec = openApi(definitions);
    const mock = fetchMock(
      spec,
      spec,
      {
        topics: [{ id: "prod-topic", slug: "signs", name_he: "Signs" }],
        questions: [
          { id: "prod-question", topic_id: "prod-topic", question_number: 1, question_he: "Q" },
        ],
        signs: [{ id: "prod-sign", sign_number: "100", name_he: "Sign" }],
        videos: [{ id: "prod-video", youtube_id: "video", title_he: "Video" }],
        resources: [{ id: "prod-resource", href: "https://example.test", title_he: "Resource" }],
      },
      {
        topics: [{ id: "qa-topic", slug: "signs", name_he: "Signs" }],
        questions: [
          { id: "qa-question", topic_id: "qa-topic", question_number: 1, question_he: "Q" },
        ],
        signs: [{ id: "qa-sign", sign_number: "100", name_he: "Sign" }],
        videos: [{ id: "qa-video", youtube_id: "video", title_he: "Video" }],
        resources: [{ id: "qa-resource", href: "https://example.test", title_he: "Resource" }],
      }
    );

    const report = await compareDatabases(production, qa, mock);

    expect(report.hasDrift).toBe(false);
    expect(report.referenceData.every((table) => table.changedRows.length === 0)).toBe(true);
    expect(vi.mocked(mock).mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });

  it("paginates through all 1,273 rows", async () => {
    const rows = Array.from({ length: 1_273 }, (_, id) => ({ id }));
    const mock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const range = new Headers(init?.headers).get("Range") ?? "0-999";
      const [start, end] = range.split("-").map(Number);
      return jsonResponse(rows.slice(start, end + 1));
    }) as typeof fetch;

    await expect(fetchAllRows(production, "questions", mock)).resolves.toHaveLength(1_273);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(new Headers(vi.mocked(mock).mock.calls[1][1]?.headers).get("Range")).toBe("1000-1999");
  });

  it("renders a concise drift report without credentials or row values", async () => {
    const productionSpec = openApi({
      topics: definition({ slug: { type: "string" }, description_ar: { type: "string" } }),
    });
    const qaSpec = openApi({
      topics: definition({ slug: { type: "string" }, description_ar: { type: "string" } }),
      videos: definition({ youtube_id: { type: "string" } }),
    });
    const mock = fetchMock(
      productionSpec,
      qaSpec,
      { topics: [{ slug: "signs", description_ar: "production text" }] },
      { topics: [{ slug: "signs", description_ar: "QA text" }] }
    );

    const output = renderReport(await compareDatabases(production, qa, mock));

    expect(output).toContain("Database alignment: DRIFT FOUND");
    expect(output).toContain("tables only in QA: videos");
    expect(output).toContain("description_ar (1)");
    expect(output).toContain("signs [description_ar]");
    expect(output).not.toContain("production text");
    expect(output).not.toContain(production.serviceRoleKey);
  });
});
